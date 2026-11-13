/**
 * A course template's own title-slide design, followed exactly.
 *
 * Hand-styled templates (each slide styled directly, no real Title layout) put their cover text
 * wherever the designer wanted: centered, low on the slide, beside a seal. Rather than drawing the
 * title slide with the built-in layout, the export copies the template's first slide and writes the
 * deck's title, subtitle and label into the template's own text boxes, in their own position, size,
 * color and alignment. Text only shrinks when it wouldn't fit the box.
 *
 * This module holds the shared, pure part: the learned description of the cover (from
 * templateStyle.ts), the font fitting both adapters use, and the preview layout.
 */

import type { SlideOf } from "../schema";
import { fitFont } from "./fit";
import type { SlideLayout, TextElement } from "./types";
import { CANVAS_H, CANVAS_W } from "./types";

export type CoverRole = "title" | "subtitle" | "kicker";

/** One of the template cover's text boxes, as the designer styled it. */
export interface CoverText {
  /** The text box's object id on the template's first slide. */
  objectId: string;
  /** Box as shares of the page (0–1). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Font size in pt on the template's page. */
  size: number;
  color: string;
  bold: boolean;
  font?: string;
  align: "left" | "center" | "right";
  valign: "top" | "middle" | "bottom";
  /** The template writes this line in capitals. */
  uppercase: boolean;
  /** Lines in the template's own sample text; the box may hold that many lines at full size. */
  lines?: number;
  /**
   * Set when the box runs under one of the cover's pictures (the template's sample text was
   * short enough not to reach it): the box is narrowed to end before the picture, and this is
   * the box's own transform and width, so the export can resize the copy the same way.
   */
  resize?: { nativeWidth: number; transform: { scaleX: number; scaleY: number; shearX: number; shearY: number; translateX: number; translateY: number } };
}

export interface TemplateCover {
  /** The template's first slide, copied for the deck's title slide. */
  slideId: string;
  /** Page size in pt. */
  pageW: number;
  pageH: number;
  title: CoverText;
  subtitle?: CoverText;
  kicker?: CoverText;
  /** The cover's other text boxes (a one-off footer line), removed from the copy. */
  otherText: string[];
}

/** Google Slides pads text boxes by 7.2pt on every side. */
export const SLIDES_TEXT_INSET = 7.2;
const LINE_HEIGHT = 1.15;

/** The deck's text for each of the cover's boxes. */
export function coverTexts(slide: SlideOf<"title">, cover: TemplateCover): Partial<Record<CoverRole, string>> {
  const out: Partial<Record<CoverRole, string>> = { title: slide.title };
  const subtitle = slide.subtitle?.trim();
  const kicker = slide.kicker?.trim();
  if (kicker && cover.kicker) out.kicker = kicker;
  // No label box in the template: the label leads the subtitle, so it isn't lost.
  const sub = [kicker && !cover.kicker ? kicker : "", subtitle ?? ""].filter(Boolean).join(" · ");
  if (sub && cover.subtitle) out.subtitle = sub;
  return out;
}

/**
 * The font size (template pt) for `text` in a cover box: the template's own size, or smaller
 * when the text wouldn't fit the box (never below 60% of it).
 */
export function fitCoverSize(text: string, box: CoverText, role: CoverRole, cover: Pick<TemplateCover, "pageW" | "pageH">): number {
  const width = box.w * cover.pageW - SLIDES_TEXT_INSET * 2;
  const height = box.h * cover.pageH - SLIDES_TEXT_INSET * 2;
  const shown = box.uppercase ? text.toUpperCase() : text;
  // A one-line box (label, single-line title) is allowed its own height plus a little; the
  // template's title box is usually sized for its sample text.
  const fit = fitFont([{ text: shown }], {
    width: Math.max(width, 1),
    height: Math.max(height, box.size * LINE_HEIGHT * (box.lines ?? 1)) + 1,
    font: role === "title" ? "heading" : "body",
    lineHeight: LINE_HEIGHT,
    paragraphGap: 0,
    maxSize: box.size,
    minSize: Math.max(8, Math.round(box.size * 0.6)),
    step: 0.5,
  });
  return fit.fontSize;
}

/**
 * The title slide drawn in the template's own cover design, for the preview. Colors are the
 * template's exact colors (TextElement.hex), and boxes are inset by the Slides text padding so
 * text lands where it does in the export.
 */
export function layoutTemplateCover(slide: SlideOf<"title">, cover: TemplateCover): SlideLayout {
  const k = CANVAS_W / cover.pageW;
  const ky = CANVAS_H / cover.pageH;
  const texts = coverTexts(slide, cover);
  const elements: TextElement[] = [];
  for (const role of ["kicker", "title", "subtitle"] as const) {
    const box = cover[role];
    const text = texts[role];
    if (!box || !text) continue;
    const size = fitCoverSize(text, box, role, cover);
    const inset = SLIDES_TEXT_INSET;
    elements.push({
      kind: "text",
      id: role,
      x: box.x * CANVAS_W + inset * k,
      y: box.y * CANVAS_H + inset * ky,
      w: Math.max(1, box.w * CANVAS_W - inset * 2 * k),
      h: Math.max(1, box.h * CANVAS_H - inset * 2 * ky),
      font: role === "title" ? "heading" : "body",
      fontSize: size * k,
      lineHeight: LINE_HEIGHT,
      paragraphGap: 0,
      color: role === "kicker" ? "accent.primary" : role === "title" ? "text.primary" : "text.secondary",
      hex: box.color,
      fontFamily: box.font,
      weight: box.bold ? 700 : 400,
      align: box.align,
      valign: box.valign,
      uppercase: box.uppercase || undefined,
      paragraphs: [{ text }],
    });
  }
  return { slideId: slide.id, background: "surface", dark: true, cover: true, elements, warnings: [], notes: slide.notes };
}
