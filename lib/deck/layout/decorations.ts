/**
 * Slide decorations the generator writes and every layout shares: a small label above a content
 * slide's title (it takes the accent bar's place, so nothing below moves) and a footer line along
 * the bottom margin. Adapters can drop them by id (`DECORATION_IDS`) when a template has none.
 */

import type { DeckSlide } from "../schema";
import { GRID } from "./kit";
import type { SlideLayout, TextElement } from "./types";
import { CANVAS_H } from "./types";

export const DECORATION_IDS = { label: "label", footer: "footer" } as const;

const LABEL_SIZE = 10;
const FOOTER_SIZE = 9;

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
  const label = slide.label?.trim();
  const bar = elements.findIndex(e => e.kind === "rect" && e.id === "accent");
  if (label && bar >= 0) {
    // A 10pt label line is about as tall as the bar plus its gap, so the title stays put.
    const y = GRID.top;
    elements[bar] = textEl(DECORATION_IDS.label, label, y, LABEL_SIZE, {
      color: "accent.primary", uppercase: true, letterSpacing: 1, paragraphs: [{ text: label, bold: true }],
    });
  }
  const footer = slide.footer?.trim();
  if (footer) {
    const y = GRID.bodyBottom + (CANVAS_H - GRID.bodyBottom - FOOTER_SIZE * 1.3) / 2;
    elements.push(textEl(DECORATION_IDS.footer, footer, y, FOOTER_SIZE, {}));
  }
  return { ...layout, elements };
}
