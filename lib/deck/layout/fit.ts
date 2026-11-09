/**
 * Text-fitting helpers. Ported from the NeXTStack deck generator, with one change: instead of
 * quietly shrinking text until it fits, they report what they did so the preview can show a badge.
 *
 * Measurement is an estimate (average glyph width per font role, greedy word wrap). It errs on the
 * side of wrapping early, so a "fits" result is reliable and an "overflow" result is worth a look.
 */

import type { FontRole, Paragraph, WarningSeverity } from "./types";

/** Average glyph width as a fraction of font size. Conservative for the theme fonts in lib/themes.ts. */
const AVG_CHAR_WIDTH: Record<FontRole, number> = {
  heading: 0.56,
  body: 0.52,
  code: 0.6, // monospace: every glyph is ~0.6em
};

const BULLET_INDENT_EM = 1.4;

/** Characters that fit on one line of the given width. */
export function charsPerLine(width: number, fontSize: number, font: FontRole, bullet = false): number {
  const usable = width - (bullet ? fontSize * BULLET_INDENT_EM : 0);
  return Math.max(1, Math.floor(usable / (fontSize * AVG_CHAR_WIDTH[font])));
}

/** Lines a string wraps to with greedy word wrap. Words longer than a line are hard-broken. */
export function wrapLines(text: string, perLine: number): number {
  let lines = 0;
  for (const raw of text.split("\n")) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines += 1;
      continue;
    }
    let current = 0;
    lines += 1;
    for (const word of words) {
      let len = word.length;
      const needed = current === 0 ? len : current + 1 + len;
      if (needed <= perLine) {
        current = needed;
        continue;
      }
      if (current > 0) {
        lines += 1;
        current = 0;
      }
      while (len > perLine) {
        lines += 1;
        len -= perLine;
      }
      current = len;
    }
  }
  return lines;
}

export interface MeasureOpts {
  width: number;
  fontSize: number;
  font: FontRole;
  lineHeight: number;
  paragraphGap: number;
}

/** Estimated rendered height (pt) of a block of paragraphs. */
export function estHeight(paragraphs: Paragraph[], o: MeasureOpts): number {
  if (paragraphs.length === 0) return 0;
  let lines = 0;
  for (const p of paragraphs) {
    lines += wrapLines(p.text, charsPerLine(o.width, o.fontSize, o.font, p.bullet));
  }
  return lines * o.fontSize * o.lineHeight + o.paragraphGap * (paragraphs.length - 1);
}

export interface FitResult {
  fontSize: number;
  /** Estimated height at the chosen size. */
  height: number;
  /** Undefined when the preferred size fits. */
  severity?: WarningSeverity;
}

export interface FitOpts extends Omit<MeasureOpts, "fontSize"> {
  height: number;
  /** Size to use when everything fits. */
  maxSize: number;
  /** Smallest size the layout accepts. */
  minSize: number;
  /** Step between tried sizes. */
  step?: number;
  /** Optional: paragraph gap scales with font size when this returns a value. */
  gapFor?: (fontSize: number) => number;
  /**
   * Shrinking down to this size is routine and not reported. Below it, the result is "shrunk".
   * Defaults to maxSize (any shrink is reported).
   */
  warnBelow?: number;
}

/**
 * Largest font size in [minSize, maxSize] whose estimated height fits the box.
 * Reports "shrunk" if it had to go below warnBelow (default maxSize), "overflow" if even minSize doesn't fit.
 */
export function fitFont(paragraphs: Paragraph[], o: FitOpts): FitResult {
  const step = o.step ?? 1;
  const measure = (size: number) =>
    estHeight(paragraphs, { ...o, fontSize: size, paragraphGap: o.gapFor ? o.gapFor(size) : o.paragraphGap });

  for (let size = o.maxSize; size >= o.minSize; size -= step) {
    const height = measure(size);
    if (height <= o.height) {
      return { fontSize: size, height, severity: size < (o.warnBelow ?? o.maxSize) ? "shrunk" : undefined };
    }
  }
  return { fontSize: o.minSize, height: measure(o.minSize), severity: "overflow" };
}

/** Body copy: prose and bullets. */
export function fitBodyFont(
  paragraphs: Paragraph[],
  o: Omit<FitOpts, "font" | "maxSize" | "minSize"> & Partial<Pick<FitOpts, "maxSize" | "minSize">>,
): FitResult {
  return fitFont(paragraphs, { maxSize: 18, minSize: 12, ...o, font: "body" });
}

/** Code panels. Code never wraps in a real editor, so overflow here means a line is too wide or too many lines. */
export function fitCodeFont(
  lines: string[],
  o: Omit<FitOpts, "font" | "maxSize" | "minSize" | "paragraphGap"> & Partial<Pick<FitOpts, "maxSize" | "minSize">>,
): FitResult {
  const maxSize = o.maxSize ?? 14;
  const minSize = o.minSize ?? 10;
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const step = o.step ?? 0.5;
  for (let size = maxSize; size >= minSize; size -= step) {
    const height = lines.length * size * o.lineHeight;
    const fitsWidth = longest <= charsPerLine(o.width, size, "code");
    if (fitsWidth && height <= o.height) {
      return { fontSize: size, height, severity: size < maxSize ? "shrunk" : undefined };
    }
  }
  return { fontSize: minSize, height: lines.length * minSize * o.lineHeight, severity: "overflow" };
}
