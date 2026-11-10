/**
 * Concept slide: title, optional lead line, bullets, and an optional aside panel on the right.
 * The workhorse layout (~60% of a NeXTStack deck).
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ ▬                                            │
 *   │ Title (1–2 lines)                            │
 *   │ Lead line, italic                            │
 *   │                                              │
 *   │ • Bullet                   ┃ ASIDE LABEL     │
 *   │ • Bullet                   ┃ Aside body…     │
 *   │ • Bullet                   ┃                 │
 *   └──────────────────────────────────────────────┘
 *
 * Without an aside, bullets take the full content width.
 */

import type { ConceptSlide } from "../schema";
import { GRID, HEADER, SlideBuilder, bullets } from "./kit";
import type { SlideLayout } from "./types";

/** Geometry constants, exported so tests and other layouts share them. */
export const CONCEPT = {
  lead: { gapAbove: 6, maxH: 44, maxSize: 15, minSize: 13, lineHeight: 1.3 },
  body: { maxSize: 18, warnBelow: 15, minSize: 12, lineHeight: 1.3, gapEm: 0.6 },
  aside: { w: 220, gap: 24, pad: 14, stripe: 4, radius: 10, labelSize: 10, labelGap: 8, maxSize: 14, minSize: 11, lineHeight: 1.35 },
} as const;

const C = CONCEPT;

/**
 * Side panel with an accent stripe, a small label, and body paragraphs. Shared with the lab
 * layout ("Done when"). Returns nothing; the panel hugs its content up to `maxH`.
 */
export function asidePanel(
  b: SlideBuilder,
  idPrefix: string,
  what: string,
  label: string,
  paragraphs: { text: string; bullet?: boolean }[],
  x: number,
  y: number,
  w: number,
  maxH: number,
  accent: "accent.primary" | "accent.secondary" | "accent.tertiary" = "accent.primary",
) {
  const A = C.aside;
  const innerX = x + A.stripe + A.pad;
  const innerW = w - A.stripe - A.pad * 2;
  const labelH = Math.ceil(A.labelSize * 1.2);
  const bodyMaxH = maxH - A.pad * 2 - labelH - A.labelGap;

  // Panel rects go first so they paint under the text; their height is fixed up after fitting.
  const panelIndex = b.elements.length;
  b.rect(`${idPrefix}.panel`, x, y, w, maxH, "panel", A.radius);
  b.rect(`${idPrefix}.stripe`, x, y, A.stripe, maxH, accent);
  b.label(`${idPrefix}.label`, label, innerX, y + A.pad, innerW, accent, A.labelSize);
  const body = b.text({
    id: `${idPrefix}.body`, what,
    paragraphs,
    x: innerX, y: y + A.pad + labelH + A.labelGap, w: innerW, h: bodyMaxH,
    maxSize: A.maxSize, minSize: A.minSize, lineHeight: A.lineHeight, gapEm: 0.5,
    color: "text.primary", hug: true,
  });
  const panelH = Math.min(A.pad * 2 + labelH + A.labelGap + body.h, maxH);
  b.elements[panelIndex].h = panelH;
  b.elements[panelIndex + 1].h = panelH;
}

export function layoutConcept(slide: ConceptSlide): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes);
  const x = GRID.marginX;
  let y = b.header(slide.title);

  if (slide.lead) {
    y += C.lead.gapAbove;
    const lead = b.text({
      id: "lead", what: "Lead line",
      paragraphs: [{ text: slide.lead, italic: true }],
      x, y, w: GRID.contentW, h: C.lead.maxH,
      maxSize: C.lead.maxSize, minSize: C.lead.minSize, lineHeight: C.lead.lineHeight,
      color: "text.secondary", hug: true,
    });
    y += lead.h;
  }

  y += HEADER.bodyGap;
  const availH = GRID.bodyBottom - y;
  const bodyW = slide.aside ? GRID.contentW - C.aside.gap - C.aside.w : GRID.contentW;

  b.text({
    id: "body", what: "Bullet list",
    paragraphs: bullets(slide.bullets),
    x, y, w: bodyW, h: availH,
    maxSize: C.body.maxSize, minSize: C.body.minSize, warnBelow: C.body.warnBelow,
    lineHeight: C.body.lineHeight, gapEm: C.body.gapEm, color: "text.secondary",
  });

  if (slide.aside) {
    asidePanel(b, "aside", "Aside panel", slide.aside.label, [{ text: slide.aside.body }], x + bodyW + C.aside.gap, y, C.aside.w, availH);
  }

  return b.build();
}
