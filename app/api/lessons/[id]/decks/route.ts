import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { projectStore } from "@/lib/projectStore";
import { canAccessLesson } from "@/lib/access";
import { serverError } from "@/lib/apiErrors";
import { lessonDeckSaveSchema, parseBody, readJson } from "@/lib/validation";
import { assertValidAst } from "@/lib/ingestionPrompt";
import { autoDeckName } from "@/lib/google";
import { isLessonDeck, listLessonDecks, uniqueDeckName } from "@/lib/lessonDecks";
import type { PresentationAST } from "@/types/slideAst";

export const dynamic = "force-dynamic";

async function load(id: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated.", status: 401 } as const;
  const lesson = await store.getById(id);
  if (!lesson) return { error: "Not found.", status: 404 } as const;
  if (!(await canAccessLesson(lesson, session.user.email))) return { error: "Forbidden.", status: 403 } as const;
  return { lesson, email: session.user.email };
}

/** The lesson's decks, newest first (earlier versions of its old single deck last). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await load(id);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(await listLessonDecks(r.lesson));
  } catch (err) {
    return serverError(err, "lesson decks");
  }
}

/** Save Draft in Notes to Slides: updates the open deck, or adds a new draft deck to the lesson. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await load(id);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    const parsed = parseBody(lessonDeckSaveSchema, await readJson(req));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    try {
      assertValidAst(parsed.data.ast);
    } catch {
      return NextResponse.json({ error: "Invalid slide data. Please regenerate and try again." }, { status: 400 });
    }
    const ast = parsed.data.ast as PresentationAST;
    const now = new Date().toISOString();
    const decks = await listLessonDecks(r.lesson);

    if (parsed.data.deckId) {
      const deck = decks.find(d => d.id === parsed.data.deckId);
      if (!deck) return NextResponse.json({ error: "That deck is no longer on this lesson." }, { status: 404 });
      const updated = await projectStore.update(deck.id, {
        presentationAST: ast,
        subtitle: ast.targetAudience,
        ...(parsed.data.slideNotes != null ? { slideNotes: parsed.data.slideNotes } : {}),
        // An exported deck keeps its file; it is just marked as behind the saved slides.
        ...(deck.url && deck.status !== "draft" ? { hasUnexportedEdits: true } : {}),
        earlierVersion: false,
        updatedAt: now,
      });
      return NextResponse.json(updated);
    }

    const created = await projectStore.create(
      {
        type: "deck",
        title: uniqueDeckName(autoDeckName(r.lesson.title, r.lesson.subtitle), decks.filter(d => isLessonDeck(d, id))),
        subtitle: ast.targetAudience,
        url: "",
        status: "draft",
        presentationAST: ast,
        slideNotes: parsed.data.slideNotes ?? "",
        lessonId: id,
        ...(r.lesson.courseId ? { courseId: r.lesson.courseId } : {}),
        updatedAt: now,
      },
      r.email,
    );
    return NextResponse.json(created);
  } catch (err) {
    return serverError(err, "save lesson deck");
  }
}
