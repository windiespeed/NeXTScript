import { getSectionContent } from "@/lib/sections";
import { isSlideAnchor, type SectionDef } from "@/types/section";

/** Minimal lesson shape the seed reads — matches both `Lesson` and `LessonInput`. */
export interface SeedableLesson {
  slideContent?: string;
  sections?: Record<string, string>;
}

/** Splits a retired Classic Slides slideContent string into {title, body} blocks ("---" lines
 * between slides, else blank lines; first line of each block is the slide title). Used to seed
 * Notes to Slides and by the Overview Doc for old Classic decks. */
export function parseClassicSlideBlocks(raw: string): { title: string; body: string }[] {
  if (!raw.trim()) return [];
  const sep = /\n---\n/;
  const blocks = sep.test(raw) ? raw.split(sep) : raw.split(/\n\s*\n/);
  return blocks
    .map(block => {
      const lines = block.trim().split("\n");
      return { title: (lines[0] ?? "").trim(), body: lines.slice(1).join("\n").trim() };
    })
    .filter(b => b.title);
}

/**
 * Turns a lesson's existing classic content (section fields + Slide Content) into one notes
 * string for Notes to Slides, in the same order the classic deck uses: "before-slides"
 * sections, then the Slide Content blocks, then "after-slides" sections. Only sections marked
 * as slide headings are carried over (doc-only ones like the rubric stay on the lesson for
 * docs and quizzes). Empty sections are skipped. Returns "" when there's nothing to carry over.
 */
export function buildNotesFromLesson(lesson: SeedableLesson, sections: SectionDef[]): string {
  const parts: string[] = [];
  const sectionPart = (s: SectionDef) => {
    if (!isSlideAnchor(s)) return;
    const content = getSectionContent(lesson, s.id).trim();
    if (content) parts.push(`## ${s.label}\n${content}`);
  };

  sections.filter(s => s.position === "before-slides").forEach(sectionPart);

  for (const block of parseClassicSlideBlocks(lesson.slideContent ?? "")) {
    parts.push(block.body ? `## ${block.title}\n${block.body}` : `## ${block.title}`);
  }

  sections.filter(s => s.position !== "before-slides").forEach(sectionPart);

  return parts.join("\n\n");
}

/** True when buildNotesFromLesson would return something — cheap check for showing the button. */
export function hasSeedableContent(lesson: SeedableLesson, sections: SectionDef[]): boolean {
  return buildNotesFromLesson(lesson, sections).length > 0;
}
