/**
 * Converts a Notes to Slides deck (types/slideAst.ts) into the deck builder's format, so Notes to
 * Slides can export onto a course's Google Slides template through the same renderer
 * (render/googleSlides.ts) that learns the template's look.
 *
 * The AST has no length limits, so long lists are split across continuation slides rather than
 * squeezed onto one. Text is passed through as written; the layouts shrink it to fit.
 *
 * Every slide carries its section label (the small line above the title), its speaker notes and
 * takeaway line, and the lesson title as its footer. This is also what the Notes to Slides preview
 * draws, so the preview and every export come from the same layouts.
 */

import type { PresentationAST, SlideNode } from "@/types/slideAst";
import { CODE_OUTPUT_OVERHEAD, LIMITS } from "./schema";
import type { DeckContent, DeckSlide } from "./schema";

const clean = (items: (string | undefined)[] | undefined) => (items ?? []).map(s => s?.trim() ?? "").filter(Boolean);

/**
 * Splits a list across slides of at most `size` items (`slack` more are allowed before splitting,
 * since list layouts shrink text to fit; grids have no room to spare), and evens the parts out so no slide is left with a lone item.
 */
function chunks<T>(items: T[], size: number, slack = 1): T[][] {
  if (items.length <= size + slack) return [items];
  const parts = Math.ceil(items.length / size);
  const per = Math.ceil(items.length / parts);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per));
  return out;
}

const cont = (title: string, i: number) => (i === 0 ? title : `${title} (cont.)`);

/** Cuts text to `max` characters at a word boundary, so a long field can't fail the deck schema. */
function cap(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

const opt = (text: string | undefined, max: number) => (text?.trim() ? cap(text, max) : undefined);

export interface ConvertOptions {
  /** Footer line on every content slide, usually the lesson title. */
  footer?: string;
}

/** One Notes to Slides slide as deck slides (more than one when a long list is split). */
export function convertAstSlide(slide: SlideNode, id: string = slide.id, options: ConvertOptions = {}): DeckSlide[] {
  return convertBody(slide, id).map((s, i) => {
    const out: DeckSlide = { ...s };
    const label = opt(slide.label, LIMITS.label);
    if (label && label.toLowerCase() !== ("title" in out ? out.title : out.heading).toLowerCase()) out.label = label;
    const footer = opt(options.footer, LIMITS.footer);
    if (footer && out.type !== "callout") out.footer = footer;
    // Notes and the takeaway belong to the slide as a whole: the first part carries them.
    if (i === 0) {
      const notes = opt(slide.notes, LIMITS.notes);
      if (notes) out.notes = notes;
      const takeaway = opt(slide.takeaway, LIMITS.takeaway);
      if (takeaway) out.takeaway = takeaway;
    }
    return out;
  });
}

function convertBody(slide: SlideNode, id: string): DeckSlide[] {
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
      const outLines = (slide.output ?? "").replace(/\s+$/, "").split("\n").filter((l, i, all) => l.trim() || i < all.length - 1);
      const output = outLines.some(l => l.trim()) ? outLines.slice(0, LIMITS.code.outputLines).map(l => l.slice(0, LIMITS.code.lineChars)) : undefined;
      // Leave room for the console panel under the code.
      const perPart = output ? LIMITS.code.lines - output.length - CODE_OUTPUT_OVERHEAD : LIMITS.code.lines;
      const parts = chunks(lines, perPart, output ? 0 : 1);
      return parts.map((part, i) => ({
        ...base,
        id: i ? `${id}-${i}` : id,
        type: "code" as const,
        title: cont(title, i),
        language: slide.language.trim() || "code",
        lines: part,
        pointOut: i === 0 && points.length ? points.slice(0, LIMITS.code.pointOut) : [i === 0 ? "Walk through it line by line." : "Continued from the last slide."],
        // The output belongs under the last part of the code.
        ...(output && i === parts.length - 1 ? { output } : {}),
      }));
    }
    case "card-row": {
      const cards = slide.cards
        .map(c => ({
          ...(c.tag?.trim() ? { tag: cap(c.tag, LIMITS.cards.tag) } : {}),
          heading: cap(c.heading || "—", LIMITS.cards.heading),
          body: cap(c.body || "—", LIMITS.cards.body),
        }))
        .filter(c => c.heading !== "—" || c.body !== "—");
      if (cards.length < 2) {
        return [{ ...base, id, type: "concept", title, bullets: cards.length ? cards.map(c => `${c.heading}: ${c.body}`) : ["—"] }];
      }
      return chunks(cards, LIMITS.cards.cards, 0).map((part, i) => ({ ...base, id: i ? `${id}-${i}` : id, type: "cards" as const, title: cont(title, i), cards: part }));
    }
    case "table": {
      const columns = (slide.columns ?? []).slice(0, LIMITS.table.columns).map(c => cap(c ?? "", LIMITS.table.cell));
      const rows = (slide.rows ?? [])
        .map(r => columns.map((_, c) => cap(r?.[c] ?? "", LIMITS.table.cell)))
        .filter(r => r.some(Boolean));
      if (columns.length < LIMITS.table.minColumns || !columns.some(Boolean) || !rows.length) {
        return [{ ...base, id, type: "concept", title, bullets: rows.length ? rows.map(r => r.filter(Boolean).join(" · ")) : ["—"] }];
      }
      return chunks(rows, LIMITS.table.rows, 0).map((part, i) => ({ ...base, id: i ? `${id}-${i}` : id, type: "table" as const, title: cont(title, i), columns, rows: part }));
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
      const parts = chunks(steps, LIMITS.steps.steps, 0);
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
  const subtitle = opt(ast.lessonSubtitle, LIMITS.title.subtitle);
  const slides: DeckSlide[] = [
    { id: "title", notes: "", type: "title", title: cap(lessonTitle, LIMITS.title.title), ...(subtitle ? { subtitle } : {}) },
  ];
  const footer = cap(lessonTitle, LIMITS.footer);
  ast.slides.forEach((s, i) => slides.push(...convertAstSlide(s, s.id || `s${i}`, { footer })));
  return { lessonTitle: cap(lessonTitle, LIMITS.deckTitle), slides };
}

/** The deck slides an AST slide becomes, for previewing one AST slide at a time. */
export function deckSlidesFor(ast: PresentationAST, index: number): DeckSlide[] {
  const slide = ast.slides[index];
  if (!slide) return [];
  const footer = cap(ast.lessonTitle.trim() || "Lesson", LIMITS.footer);
  return convertAstSlide(slide, slide.id || `s${index}`, { footer });
}
