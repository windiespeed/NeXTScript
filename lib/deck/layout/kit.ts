/**
 * Shared building blocks for the layout functions: the canvas grid, a builder that collects
 * elements and warnings, and a fitted-text helper. Each layout composes these so the geometry
 * rules (margins, title treatment, warning wording) stay the same across all 14 slide types.
 */

import { fitFont } from "./fit";
import type { FitResult } from "./fit";
import type { ColorToken, FontRole, LayoutElement, OverflowWarning, Paragraph, SlideLayout, TextElement } from "./types";
import { CANVAS_H, CANVAS_W } from "./types";

export const GRID = {
  marginX: 40,
  top: 34,
  bottom: 36,
  contentW: CANVAS_W - 80,
  bodyBottom: CANVAS_H - 36,
  gutter: 20,
} as const;

/**
 * Space held back at the bottom of the body area while a slide is laid out, for the takeaway
 * line (lib/deck/layout/decorations.ts). Layouts are synchronous, so the registry sets it around
 * one layout call and every content layout reads it through `bodyBottom()`.
 */
let reservedBottom = 0;

/** Bottom edge of the body area for the slide being laid out. */
export function bodyBottom(): number {
  return GRID.bodyBottom - reservedBottom;
}

/** Runs `fn` with `pt` reserved at the bottom of the body area. */
export function withReservedBottom<T>(pt: number, fn: () => T): T {
  const before = reservedBottom;
  reservedBottom = pt;
  try {
    return fn();
  } finally {
    reservedBottom = before;
  }
}

export const HEADER = {
  accentBar: { w: 40, h: 4 },
  titleGap: 10,
  title: { maxH: 64, maxSize: 26, minSize: 20, lineHeight: 1.15 },
  bodyGap: 18,
} as const;

/** Where the standard header puts a content slide's title on the canvas. */
export const HEADER_TITLE_Y = GRID.top + HEADER.accentBar.h + HEADER.titleGap;

export interface TextSpec {
  id: string;
  /** What the warning calls this element, e.g. "Bullet list". */
  what: string;
  paragraphs: Paragraph[];
  x: number;
  y: number;
  w: number;
  /** The most height the text may use. */
  h: number;
  font?: FontRole;
  maxSize: number;
  minSize: number;
  /** Shrinking down to this size isn't reported. */
  warnBelow?: number;
  lineHeight?: number;
  /** Space between paragraphs, as a multiple of the font size. */
  gapEm?: number;
  color: ColorToken;
  align?: TextElement["align"];
  valign?: TextElement["valign"];
  uppercase?: boolean;
  letterSpacing?: number;
  /** Shrink the element's box to the text's estimated height (for stacking). Default false. */
  hug?: boolean;
}

export class SlideBuilder {
  readonly elements: LayoutElement[] = [];
  readonly warnings: OverflowWarning[] = [];

  constructor(
    private readonly slideId: string,
    private readonly notes: string,
    private readonly dark = false,
  ) {}

  rect(id: string, x: number, y: number, w: number, h: number, fill: ColorToken, radius = 0) {
    this.elements.push({ kind: "rect", id, x, y, w, h, fill, radius });
  }

  warn(elementId: string, fit: FitResult, what: string) {
    if (!fit.severity) return;
    const message =
      fit.severity === "overflow"
        ? `${what} doesn't fit, even at ${fit.fontSize}pt. Shorten it or move some of it to the notes.`
        : `${what} was shrunk to ${fit.fontSize}pt to fit.`;
    this.warnings.push({ slideId: this.slideId, elementId, severity: fit.severity, message });
  }

  /** Estimated height the text would take in a box of this width (capped at `h`). Adds nothing. */
  measure(s: Pick<TextSpec, "paragraphs" | "w" | "h" | "font" | "maxSize" | "minSize" | "lineHeight" | "gapEm">): number {
    const gapEm = s.gapEm ?? 0;
    const gapFor = (size: number) => Math.round(size * gapEm * 10) / 10;
    const fit = fitFont(s.paragraphs, {
      width: s.w, height: s.h, font: s.font ?? "body", maxSize: s.maxSize, minSize: s.minSize,
      lineHeight: s.lineHeight ?? 1.3, paragraphGap: gapFor(s.maxSize), gapFor,
    });
    return Math.min(Math.ceil(fit.height), s.h);
  }

  /** Adds a text element sized to fit its box, records any warning, and returns the element. */
  text(s: TextSpec): TextElement {
    const font = s.font ?? "body";
    const lineHeight = s.lineHeight ?? 1.3;
    const gapEm = s.gapEm ?? 0;
    const gapFor = (size: number) => Math.round(size * gapEm * 10) / 10;
    const fit = fitFont(s.paragraphs, {
      width: s.w,
      height: s.h,
      font,
      maxSize: s.maxSize,
      minSize: s.minSize,
      warnBelow: s.warnBelow,
      lineHeight,
      paragraphGap: gapFor(s.maxSize),
      gapFor,
    });
    const el: TextElement = {
      kind: "text",
      id: s.id,
      x: s.x,
      y: s.y,
      w: s.w,
      h: s.hug ? Math.min(Math.ceil(fit.height), s.h) : s.h,
      font,
      fontSize: fit.fontSize,
      lineHeight,
      paragraphGap: gapFor(fit.fontSize),
      color: s.color,
      align: s.align ?? "left",
      valign: s.valign ?? "top",
      uppercase: s.uppercase,
      letterSpacing: s.letterSpacing,
      paragraphs: s.paragraphs,
    };
    this.elements.push(el);
    this.warn(s.id, fit, s.what);
    return el;
  }

  /** Small all-caps label, e.g. "DONE WHEN". Returns its height. */
  label(id: string, text: string, x: number, y: number, w: number, color: ColorToken = "accent.primary", size = 10): number {
    const h = Math.ceil(size * 1.2);
    this.elements.push({
      kind: "text", id, x, y, w, h,
      font: "body", fontSize: size, lineHeight: 1.2, paragraphGap: 0,
      color, align: "left", valign: "top", uppercase: true, letterSpacing: 1,
      paragraphs: [{ text, bold: true }],
    });
    return h;
  }

  /**
   * The standard content-slide header: accent bar and a 1–2 line title.
   * Returns the y where the next element (lead or body) starts, before any gap.
   */
  header(title: string, titleW: number = GRID.contentW): number {
    const x = GRID.marginX;
    let y = GRID.top;
    this.rect("accent", x, y, HEADER.accentBar.w, HEADER.accentBar.h, "accent.primary", 2);
    y += HEADER.accentBar.h + HEADER.titleGap;
    const el = this.text({
      id: "title", what: "Title",
      paragraphs: [{ text: title }],
      x, y, w: titleW, h: HEADER.title.maxH,
      font: "heading", maxSize: HEADER.title.maxSize, minSize: HEADER.title.minSize,
      lineHeight: HEADER.title.lineHeight, color: "text.primary", hug: true,
    });
    return y + el.h;
  }

  build(): SlideLayout {
    return {
      slideId: this.slideId,
      background: "surface",
      dark: this.dark,
      elements: this.elements,
      warnings: this.warnings,
      notes: this.notes,
    };
  }
}

/** Splits `total` into `n` equal parts separated by `gap`. */
export function split(total: number, n: number, gap: number): number {
  return (total - gap * (n - 1)) / n;
}

/** Bullet paragraphs from strings. */
export const bullets = (items: string[]): Paragraph[] => items.map(text => ({ text, bullet: true }));

/** Numbered paragraphs ("1. …") from strings. */
export const numbered = (items: string[]): Paragraph[] => items.map((text, i) => ({ text: `${i + 1}. ${text}` }));
