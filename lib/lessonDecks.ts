import { projectStore } from "@/lib/projectStore";
import { store } from "@/lib/store";
import { autoDeckName } from "@/lib/google";
import type { Lesson } from "@/types/lesson";
import type { SavedProject } from "@/types/project";

/**
 * A lesson's slide decks. Each deck is its own "deck" SavedProject (lessonId = the lesson), with
 * its own slides (presentationAST), notes, status and exported file, so a lesson can have any
 * number of them. Before this, a lesson kept one working deck on itself (lesson.presentationAST)
 * and every export added another record; migrateLessonDecks() moves those into this model once.
 */

export function isLessonDeck(p: SavedProject, lessonId: string): boolean {
  return p.type === "deck" && (p.lessonId === lessonId || !!p.lessonIds?.includes(lessonId));
}

/** True for decks that have a file in Drive (drafts don't, until their first export). */
export function isExported(p: SavedProject): boolean {
  return !!p.url && p.status !== "draft";
}

/** Newest first, by last change. */
function byRecent(a: SavedProject, b: SavedProject): number {
  return (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt);
}

/**
 * One-time move of a lesson's old single deck into the many-decks model:
 * - Older exports of that one deck (every export used to add a record) are marked earlierVersion,
 *   leaving the newest as the lesson's deck. Nothing is deleted.
 * - A draft saved on the lesson after its last export becomes its own draft deck.
 * Safe to call on every read; it does nothing once lesson.decksMigrated is set.
 */
export async function migrateLessonDecks(lesson: Lesson, decks: SavedProject[]): Promise<SavedProject[]> {
  if (lesson.decksMigrated) return decks;
  const out = [...decks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const legacy = out.filter(d => !d.updatedAt && !d.earlierVersion);
  for (const old of legacy.slice(1)) {
    await projectStore.update(old.id, { earlierVersion: true });
    old.earlierVersion = true;
  }

  const draft = lesson.presentationAST && lesson.presentationStatus !== "exported" ? lesson.presentationAST : null;
  if (draft) {
    const now = new Date().toISOString();
    const created = await projectStore.create(
      {
        type: "deck",
        title: autoDeckName(lesson.title, lesson.subtitle),
        subtitle: draft.targetAudience,
        url: "",
        status: "draft",
        presentationAST: draft,
        slideNotes: lesson.slideNotes ?? "",
        lessonId: lesson.id,
        ...(lesson.courseId ? { courseId: lesson.courseId } : {}),
        updatedAt: now,
      },
      lesson.userId,
    );
    out.unshift(created);
  }

  // The lesson's own copy is now either in a draft deck or the same as its newest export.
  await store.update(lesson.id, { decksMigrated: true, presentationAST: null, presentationStatus: null } as unknown as Partial<Lesson>);
  return out;
}

/** Every deck of a lesson (any author), migrated, newest first. Earlier versions come last. */
export async function listLessonDecks(lesson: Lesson): Promise<SavedProject[]> {
  const raw = (await projectStore.getAllForLessonIds([lesson.id])).filter(p => isLessonDeck(p, lesson.id));
  const decks = await migrateLessonDecks(lesson, raw);
  return decks.sort((a, b) => Number(!!a.earlierVersion) - Number(!!b.earlierVersion) || byRecent(a, b));
}

/** The decks a lesson posts to Google Classroom: every exported deck except earlier versions. */
export function classroomDecks(decks: SavedProject[]): SavedProject[] {
  return decks.filter(d => isExported(d) && !d.earlierVersion);
}

/** A name for a new deck that doesn't repeat one the lesson already has ("…", "… (Deck 2)"). */
export function uniqueDeckName(base: string, existing: SavedProject[]): string {
  const taken = new Set(existing.map(d => d.title));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const name = `${base} (Deck ${n})`;
    if (!taken.has(name)) return name;
  }
}
