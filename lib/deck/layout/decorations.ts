/**
 * Slide decorations the generator writes and every layout shares: a small label above a content
 * slide's title (it takes the accent bar's place, so nothing below moves), a takeaway line in the
 * accent color at the bottom of the body area (the registry reserves room for it before the
 * layout runs), and a footer line along the bottom margin. Adapters can drop the label and footer
 * by id (`DECORATION_IDS`) when a template has none.
 */

import { DARK_SLIDE_TYPES } from "../schema";
import type { DeckSlide } from "../schema";
import { fitFont } from "./fit";
import { GRID } from "./kit";
import type { SlideLayout, TextElement } from "./types";
import { CANVAS_H } from "./types";

export const DECORATION_IDS = { label: "label", footer: "footer", takeaway: "takeaway" } as const;

const LABEL_SIZE = 10;
const FOOTER_SIZE = 9;
const TAKEAWAY = { maxSize: 14, minSize: 12, lineHeight: 1.25, gap: 12, maxH: 40 } as const;

function takeawayText(slide: DeckSlide): string | undefined {
  if (DARK_SLIDE_TYPES.has(slide.type)) return undefined;
  return slide.takeaway?.trim() || undefined;
}

function fitTakeaway(text: string) {
  return fitFont([{ text, bold: true }], {
    width: GRID.contentW, height: TAKEAWAY.maxH, font: "body",
    maxSize: TAKEAWAY.maxSize, minSize: TAKEAWAY.minSize, lineHeight: TAKEAWAY.lineHeight, paragraphGap: 0,
  });
}

/** Points to hold back at the bottom of the body area for this slide's takeaway line (0 if none). */
export function takeawayReserve(slide: DeckSlide): number {
  const text = takeawayText(slide);
  if (!text) return 0;
  return Math.ceil(Math.min(fitTakeaway(text).height, TAKEAWAY.maxH)) + TAKEAWAY.gap;
}
/** Top of the footer line on the canvas. */
export const FOOTER_Y = GRID.bodyBottom + (CANVAS_H - GRID.bodyBottom - FOOTER_SIZE * 1.3) / 2;

function textEl(id: string, text: string, y: number, size: number, extra: Partial<TextElement>): TextElement {
  return {
    kind: "text", id, x: GRID.marginX, y, w: GRID.contentW, h: Math.ceil(size * 1.3),
    font: "body", fontSize: size, lineHeight: 1.2, paragraphGap: 0,
    color: "text.muted", align: "left", valign: "top",
    paragraphs: [{ text }],
    ...extra,
  };
}

export function decorate(layout: SlideLayout, slide: DeckSlide): SlideLayout {
  const elements = [...layout.elements];
  const label = DARK_SLIDE_TYPES.has(slide.type) ? undefined : slide.label?.trim();
  const bar = elements.findIndex(e => e.kind === "rect" && e.id === "accent");
  if (label && bar >= 0) {
    // A 10pt label line is about as tall as the bar plus its gap, so the title stays put.
    const y = GRID.top;
    elements[bar] = textEl(DECORATION_IDS.label, label, y, LABEL_SIZE, {
      color: "accent.primary", uppercase: true, letterSpacing: 1, paragraphs: [{ text: label, bold: true }],
    });
  }
  const takeaway = takeawayText(slide);
  if (takeaway) {
    const fit = fitTakeaway(takeaway);
    const h = Math.ceil(Math.min(fit.height, TAKEAWAY.maxH));
    // Right under the content when it ends early (panels and lists hug their content), else at
    // the bottom of the body area, where the layout left room for it.
    const contentBottom = Math.max(
      0,
      ...elements.filter(e => !(Object.values(DECORATION_IDS) as string[]).includes(e.id) && e.id !== "title" && e.id !== "accent").map(e => e.y + e.h),
    );
    const y = Math.min(GRID.bodyBottom - h, Math.ceil(contentBottom) + TAKEAWAY.gap + 6);
    elements.push({
      ...textEl(DECORATION_IDS.takeaway, takeaway, y, fit.fontSize, {
        color: "accent.primary", lineHeight: TAKEAWAY.lineHeight, paragraphs: [{ text: takeaway, bold: true }],
      }),
      h,
    });
    if (fit.severity === "overflow") {
      layout = { ...layout, warnings: [...layout.warnings, { slideId: layout.slideId, elementId: DECORATION_IDS.takeaway, severity: "overflow", message: "Takeaway doesn't fit on two lines. Shorten it." }] };
    }
  }
  const footer = slide.footer?.trim();
  if (footer) {
    elements.push(textEl(DECORATION_IDS.footer, footer, FOOTER_Y, FOOTER_SIZE, {}));
  }
  return { ...layout, elements };
}
