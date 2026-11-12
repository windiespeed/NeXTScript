/**
 * Converts a Notes to Slides deck (types/slideAst.ts) into the deck builder's format, so Notes to
 * Slides can export onto a course's Google Slides template through the same renderer
 * (render/googleSlides.ts) that learns the template's look.
 *
 * The AST has no length limits, so long lists are split across continuation slides rather than
 * squeezed onto one. Text is passed through as written; the layouts shrink it to fit.
 */

import type { PresentationAST, SlideNode } from "@/types/slideAst";
import { LIMITS } from "./schema";
import type { DeckContent, DeckSlide } from "./schema";

const clean = (items: (string | undefined)[] | undefined) => (items ?? []).map(s => s?.trim() ?? "").filter(Boolean);

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out.length ? out : [[]];
}

const cont = (title: string, i: number) => (i === 0 ? title : `${title} (cont.)`);

function convert(slide: SlideNode, id: string): DeckSlide[] {
  const title = slide.title.trim() || "Untitled";
  const base = { notes: "" };
  switch (slide.type) {
    case "standard": {
      const paragraphs = clean(slide.paragraphs);
      const bullets = clean(slide.bulletPoints);
      // A lone paragraph frames the slide; otherwise every paragraph and bullet becomes a point.
      const lead = bullets.length && paragraphs.length === 1 ? paragraphs[0] : slide.subtitle?.trim() || undefined;
      const points = bullets.length && paragraphs.length === 1 ? bullets : [...paragraphs, ...bullets];
      if (!points.length) {
        return [{ ...base, id, type: "callout", variant: "key-idea", heading: title, ...(lead ? { body: lead } : {}) }];
      }
      return chunks(points, LIMITS.concept.bullets).map((part, i) => ({
        ...base,
        id: i ? `${id}-${i}` : id,
        type: "concept" as const,
        title: cont(title, i),
        ...(lead && i === 0 ? { lead } : {}),
        bullets: part,
      }));
    }
    case "split-column":
      return [{
        ...base, id, type: "compare", title,
        left: { heading: slide.leftColumn.heading.trim() || "Left", points: clean(slide.leftColumn.content).length ? clean(slide.leftColumn.content) : ["—"] },
        right: { heading: slide.rightColumn.heading.trim() || "Right", points: clean(slide.rightColumn.content).length ? clean(slide.rightColumn.content) : ["—"] },
      }];
    case "code-explainer": {
      const lines = slide.codeSnippet.replace(/\s+$/, "").split("\n");
      const points = clean(slide.explanationPoints);
      return chunks(lines, LIMITS.code.lines).map((part, i) => ({
        ...base,
        id: i ? `${id}-${i}` : id,
        type: "code" as const,
        title: cont(title, i),
        language: slide.language.trim() || "code",
        lines: part,
        pointOut: i === 0 && points.length ? points.slice(0, LIMITS.code.pointOut) : [i === 0 ? "Walk through it line by line." : "Continued from the last slide."],
      }));
    }
    case "callout":
      return [{
        ...base, id, type: "callout",
        variant: slide.variant,
        heading: title,
        ...(slide.content.trim() ? { body: slide.content.trim() } : {}),
      }];
    case "step-grid": {
      const steps = [...slide.steps].sort((a, b) => a.stepNumber - b.stepNumber).map(s => ({ title: s.title.trim() || `Step ${s.stepNumber}`, detail: s.description.trim() || "—" }));
      const parts = chunks(steps, LIMITS.steps.steps);
      return parts.map((part, i) =>
        part.length >= 2
          ? { ...base, id: i ? `${id}-${i}` : id, type: "steps" as const, title: cont(title, i), steps: part }
          : { ...base, id: i ? `${id}-${i}` : id, type: "concept" as const, title: cont(title, i), bullets: part.map(s => `${s.title}: ${s.detail}`).concat(part.length ? [] : ["—"]) },
      );
    }
  }
}

export function astToDeck(ast: PresentationAST): DeckContent {
  const lessonTitle = ast.lessonTitle.trim() || "Lesson";
  const slides: DeckSlide[] = [
    { id: "title", notes: "", type: "title", title: lessonTitle },
  ];
  ast.slides.forEach((s, i) => slides.push(...convert(s, s.id || `s${i}`)));
  return { lessonTitle, slides };
}
