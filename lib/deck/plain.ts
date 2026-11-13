/**
 * The "Plain (no theme)" look: every slide reduced to a title, an optional subtitle and a list of
 * lines, the way Google Slides' own Title, Section header and Title and body layouts hold them.
 *
 * Exported decks set no colors, fonts or backgrounds, so whichever Google Slides theme the
 * instructor picks afterwards restyles the whole deck. The preview draws the same text plainly.
 */

import type { DeckSlide } from "./schema";
import type { SlideLayout, TextElement } from "./layout/types";
import { CANVAS_H, CANVAS_W } from "./layout/types";
import { GRID } from "./layout/kit";
import { fitFont } from "./layout/fit";

export interface PlainLine {
  text: string;
  /** 0 for a top-level bullet, 1 for a nested one. */
  level: 0 | 1;
  /** Code, shown in a monospace font without a bullet. */
  code?: boolean;
  /** A heading line inside the body (a column or card name), shown without a bullet. */
  heading?: boolean;
}

export interface PlainSlide {
  kind: "title" | "section" | "content";
  title: string;
  subtitle?: string;
  lines: PlainLine[];
  notes: string;
}

const join = (...parts: (string | undefined)[]) => parts.map(p => p?.trim()).filter(Boolean).join(" · ");
const bullet = (text: string, level: 0 | 1 = 0): PlainLine => ({ text, level });
const head = (text: string): PlainLine => ({ text, level: 0, heading: true });

/** One deck slide as plain title + lines. */
export function plainSlide(slide: DeckSlide): PlainSlide {
  const notes = slide.notes;
  const withTakeaway = (lines: PlainLine[]) => ("takeaway" in slide && slide.takeaway ? [...lines, bullet(slide.takeaway)] : lines);
  switch (slide.type) {
    case "title":
      return { kind: "title", title: slide.title, subtitle: join(slide.kicker, slide.subtitle) || undefined, lines: [], notes };
    case "section":
      return { kind: "section", title: slide.title, subtitle: join(slide.kicker, slide.subtitle) || undefined, lines: [], notes };
    case "callout":
      return { kind: "content", title: slide.heading, lines: slide.body ? [bullet(slide.body)] : [], notes };
    case "closing":
      return {
        kind: "content",
        title: slide.title,
        lines: [...(slide.takeaways ?? []).map(t => bullet(t)), ...(slide.nextUp ? [bullet(`Next up: ${slide.nextUp}`)] : [])],
        notes,
      };
    case "agenda":
      return { kind: "content", title: slide.title, lines: withTakeaway(slide.items.map(i => bullet(i.minutes ? `${i.label} (${i.minutes} min)` : i.label))), notes };
    case "objectives":
      return { kind: "content", title: slide.title, lines: withTakeaway(slide.objectives.map(o => bullet(o))), notes };
    case "concept":
      return {
        kind: "content",
        title: slide.title,
        lines: withTakeaway([
          ...(slide.lead ? [head(slide.lead)] : []),
          ...slide.bullets.map(b => bullet(b)),
          ...(slide.aside ? [bullet(`${slide.aside.label}: ${slide.aside.body}`)] : []),
        ]),
        notes,
      };
    case "code":
      return {
        kind: "content",
        title: slide.title,
        lines: withTakeaway([
          ...slide.lines.map(l => ({ text: l, level: 0 as const, code: true })),
          ...(slide.output ? [head("Output"), ...slide.output.map(l => ({ text: l, level: 0 as const, code: true }))] : []),
          ...(slide.caption ? [head(slide.caption)] : []),
          ...slide.pointOut.map(p => bullet(p)),
        ]),
        notes,
      };
    case "compare":
      return {
        kind: "content",
        title: slide.title,
        lines: withTakeaway([slide.left, slide.right].flatMap(side => [bullet(side.heading), ...side.points.map(p => bullet(p, 1))])),
        notes,
      };
    case "cards":
      return { kind: "content", title: slide.title, lines: withTakeaway(slide.cards.map(c => bullet(`${c.heading}: ${c.body}`))), notes };
    case "table":
      return {
        kind: "content",
        title: slide.title,
        lines: withTakeaway(slide.rows.map(row => bullet(row.map((cell, i) => (slide.columns[i] ? `${slide.columns[i]}: ${cell}` : cell)).join(" · ")))),
        notes,
      };
    case "steps":
      return { kind: "content", title: slide.title, lines: withTakeaway(slide.steps.map((s, i) => bullet(`${i + 1}. ${s.title}: ${s.detail}`))), notes };
    case "pitfalls":
      return {
        kind: "content",
        title: slide.title,
        lines: withTakeaway(slide.pairs.flatMap(p => [bullet(`Instead of: ${p.wrong}`), bullet(`Do: ${p.right}${p.why ? ` (${p.why})` : ""}`, 1)])),
        notes,
      };
    case "lab":
      return {
        kind: "content",
        title: slide.minutes ? `${slide.title} (${slide.minutes} min)` : slide.title,
        lines: withTakeaway([...slide.tasks.map(t => bullet(t)), bullet("Done when:"), ...slide.doneWhen.map(d => bullet(d, 1))]),
        notes,
      };
    case "exit-ticket":
      return {
        kind: "content",
        title: slide.title,
        lines: withTakeaway([...slide.questions.map(q => bullet(q)), ...(slide.homework ? [bullet(`Homework: ${slide.homework}`)] : [])]),
        notes,
      };
  }
}

/** The plain slide drawn simply, for the preview: black text on white, like Google's Simple theme. */
export function layoutPlain(slide: DeckSlide): SlideLayout {
  const p = plainSlide(slide);
  const elements: TextElement[] = [];
  const text = (el: Omit<TextElement, "kind" | "lineHeight" | "paragraphGap" | "valign"> & Partial<Pick<TextElement, "valign" | "paragraphGap" | "lineHeight">>): TextElement => ({
    kind: "text", lineHeight: 1.2, paragraphGap: 6, valign: "top", ...el,
  });
  const x = GRID.marginX;
  const w = CANVAS_W - x * 2;
  if (p.kind !== "content") {
    const centered = p.kind === "title";
    elements.push(text({
      id: "title", x, y: centered ? 120 : 150, w, h: 90, font: "heading", fontSize: centered ? 40 : 32, color: "text.primary",
      align: centered ? "center" : "left", valign: "bottom", paragraphs: [{ text: p.title }],
    }));
    if (p.subtitle) {
      elements.push(text({ id: "subtitle", x, y: centered ? 222 : 248, w, h: 50, font: "body", fontSize: 18, color: "text.secondary", align: centered ? "center" : "left", paragraphs: [{ text: p.subtitle }] }));
    }
  } else {
    elements.push(text({ id: "title", x, y: 30, w, h: 50, font: "heading", fontSize: 26, color: "text.primary", align: "left", valign: "middle", paragraphs: [{ text: p.title }] }));
    const paragraphs = p.lines.map(l => ({ text: l.level ? ` ${l.text}` : l.text, bullet: !l.code && !l.heading, bold: l.heading || undefined }));
    const box = { width: w, height: CANVAS_H - 100 - 24, font: "body" as const, lineHeight: 1.25, paragraphGap: 4 };
    const fit = fitFont(paragraphs, { ...box, maxSize: 16, minSize: 10 });
    if (paragraphs.length) {
      elements.push(text({ id: "body", x, y: 100, w, h: box.height, font: "body", fontSize: fit.fontSize, lineHeight: 1.25, paragraphGap: 4, color: "text.secondary", align: "left", paragraphs }));
    }
  }
  return { slideId: slide.id, background: "surface", dark: false, ...(p.kind === "title" ? { cover: true } : {}), elements, warnings: [], notes: slide.notes };
}
