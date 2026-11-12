/**
 * Top-bar search over the lessons and courses a user can see.
 *
 * Every word of the query has to appear somewhere in the item (case-insensitive), so
 * "react hooks" finds a lesson titled "Intro to React" whose topics mention hooks.
 * Title matches rank above matches in other fields.
 */
import type { Course } from "@/types/course";
import type { Lesson } from "@/types/lesson";

export interface CourseHit {
  id: string;
  title: string;
  description: string;
  subject: string;
  term: string;
  lessonCount: number;
}

export interface LessonHit {
  id: string;
  title: string;
  subtitle: string;
  status: Lesson["status"];
  deadline: string;
  courseId?: string;
  courseTitle?: string;
  /** A short piece of the text that matched, when the title didn't. */
  snippet?: string;
}

export interface SearchResults {
  query: string;
  courses: CourseHit[];
  lessons: LessonHit[];
}

export const MAX_RESULTS = 50;

export function queryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).map(w => w.trim()).filter(Boolean);
}

type Field = { name: string; text: string };

/** Higher is better; null when some word isn't found anywhere. */
function score(words: string[], fields: Field[]): number | null {
  const lowered = fields.map(f => f.text.toLowerCase());
  const title = lowered[0] ?? "";
  let total = 0;
  for (const word of words) {
    if (title.includes(word)) total += title.startsWith(word) ? 12 : 10;
    else if (lowered.some(t => t.includes(word))) total += 1;
    else return null;
  }
  if (title === words.join(" ")) total += 20;
  return total;
}

/** The first non-title field containing a query word, trimmed around the match. */
function snippetFor(words: string[], fields: Field[]): string | undefined {
  for (const field of fields.slice(1)) {
    const text = field.text.replace(/\s+/g, " ").trim();
    const lower = text.toLowerCase();
    for (const word of words) {
      const at = lower.indexOf(word);
      if (at === -1) continue;
      const start = Math.max(0, at - 40);
      const end = Math.min(text.length, at + word.length + 80);
      return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
    }
  }
  return undefined;
}

function lessonFields(l: Lesson): Field[] {
  return [
    { name: "title", text: l.title ?? "" },
    { name: "subtitle", text: l.subtitle ?? "" },
    { name: "topics", text: l.topics ?? "" },
    { name: "tag", text: l.tag ?? "" },
    { name: "overview", text: l.overview ?? "" },
    { name: "learningTargets", text: l.learningTargets ?? "" },
    { name: "vocabulary", text: l.vocabulary ?? "" },
  ];
}

function courseFields(c: Course): Field[] {
  return [
    { name: "title", text: c.title ?? "" },
    { name: "description", text: c.description ?? "" },
    { name: "subject", text: c.settings?.subject ?? "" },
    { name: "industry", text: c.settings?.industry ?? "" },
    { name: "gradeLevel", text: c.gradeLevel ?? "" },
    { name: "term", text: `${c.term ?? ""} ${c.semester ?? ""}` },
  ];
}

export function searchAll(query: string, courses: Course[], lessons: Lesson[]): SearchResults {
  const words = queryWords(query);
  const empty = { query: query.trim(), courses: [], lessons: [] };
  if (words.length === 0) return empty;

  const courseTitles = new Map(courses.map(c => [c.id, c.title]));

  const courseHits = courses
    .map(c => ({ c, s: score(words, courseFields(c)) }))
    .filter((x): x is { c: Course; s: number } => x.s !== null)
    .sort((a, b) => b.s - a.s || a.c.title.localeCompare(b.c.title))
    .slice(0, MAX_RESULTS)
    .map(({ c }): CourseHit => ({
      id: c.id,
      title: c.title,
      description: c.description ?? "",
      subject: c.settings?.subject ?? "",
      term: [c.term, c.semester].filter(Boolean).join(" · "),
      lessonCount: c.lessonIds?.length ?? 0,
    }));

  const lessonHits = lessons
    .map(l => {
      const fields = lessonFields(l);
      return { l, fields, s: score(words, fields) };
    })
    .filter((x): x is { l: Lesson; fields: Field[]; s: number } => x.s !== null)
    .sort((a, b) => b.s - a.s || (b.l.updatedAt ?? "").localeCompare(a.l.updatedAt ?? ""))
    .slice(0, MAX_RESULTS)
    .map(({ l, fields }): LessonHit => {
      const titleMatches = words.every(w => (l.title ?? "").toLowerCase().includes(w));
      return {
        id: l.id,
        title: l.title,
        subtitle: l.subtitle ?? "",
        status: l.status,
        deadline: l.deadline ?? "",
        courseId: l.courseId,
        courseTitle: l.courseId ? courseTitles.get(l.courseId) : undefined,
        snippet: titleMatches ? undefined : snippetFor(words, fields),
      };
    });

  return { query: query.trim(), courses: courseHits, lessons: lessonHits };
}
