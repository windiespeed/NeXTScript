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
import { fitBodyFont, fitFont } from "./fit";
import type { FitResult } from "./fit";
import type { LayoutElement, OverflowWarning, Paragraph, SlideLayout, TextElement } from "./types";
import { CANVAS_H, CANVAS_W } from "./types";

/** Geometry constants, exported so tests and future layouts share them. */
export const CONCEPT = {
  marginX: 40,
  top: 34,
  bottom: 36,
  accentBar: { w: 40, h: 4 },
  title: { gapAbove: 10, maxH: 64, maxSize: 26, minSize: 20, lineHeight: 1.15 },
  lead: { gapAbove: 6, maxH: 44, maxSize: 15, minSize: 13, lineHeight: 1.3 },
  body: { gapAbove: 18, maxSize: 18, warnBelow: 15, minSize: 12, lineHeight: 1.3, gapEm: 0.6 },
  aside: { w: 220, gap: 24, pad: 14, stripe: 4, radius: 10, labelSize: 10, labelGap: 8, maxSize: 14, minSize: 11, lineHeight: 1.35 },
} as const;

const C = CONCEPT;
const CONTENT_W = CANVAS_W - C.marginX * 2;
const BODY_BOTTOM = CANVAS_H - C.bottom;

function warn(slideId: string, elementId: string, fit: FitResult, what: string): OverflowWarning[] {
  if (!fit.severity) return [];
  const message =
    fit.severity === "overflow"
      ? `${what} doesn't fit, even at ${fit.fontSize}pt. Shorten it or move some of it to the notes.`
      : `${what} was shrunk to ${fit.fontSize}pt to fit.`;
  return [{ slideId, elementId, severity: fit.severity, message }];
}

function textEl(e: Omit<TextElement, "kind" | "align" | "valign"> & Partial<Pick<TextElement, "align" | "valign">>): TextElement {
  return { kind: "text", align: "left", valign: "top", ...e };
}

export function layoutConcept(slide: ConceptSlide): SlideLayout {
  const elements: LayoutElement[] = [];
  const warnings: OverflowWarning[] = [];
  const x = C.marginX;
  let y = C.top;

  // Accent bar
  elements.push({ kind: "rect", id: "accent", x, y, w: C.accentBar.w, h: C.accentBar.h, fill: "accent.primary", radius: 2 });
  y += C.accentBar.h + C.title.gapAbove;

  // Title
  const titleParas: Paragraph[] = [{ text: slide.title }];
  const titleFit = fitFont(titleParas, {
    width: CONTENT_W,
    height: C.title.maxH,
    font: "heading",
    maxSize: C.title.maxSize,
    minSize: C.title.minSize,
    lineHeight: C.title.lineHeight,
    paragraphGap: 0,
  });
  const titleH = Math.min(titleFit.height, C.title.maxH);
  elements.push(
    textEl({
      id: "title", x, y, w: CONTENT_W, h: titleH,
      font: "heading", fontSize: titleFit.fontSize, lineHeight: C.title.lineHeight, paragraphGap: 0,
      color: "text.primary", paragraphs: titleParas,
    }),
  );
  warnings.push(...warn(slide.id, "title", titleFit, "Title"));
  y += titleH;

  // Lead
  if (slide.lead) {
    y += C.lead.gapAbove;
    const leadParas: Paragraph[] = [{ text: slide.lead, italic: true }];
    const leadFit = fitFont(leadParas, {
      width: CONTENT_W,
      height: C.lead.maxH,
      font: "body",
      maxSize: C.lead.maxSize,
      minSize: C.lead.minSize,
      lineHeight: C.lead.lineHeight,
      paragraphGap: 0,
    });
    const leadH = Math.min(leadFit.height, C.lead.maxH);
    elements.push(
      textEl({
        id: "lead", x, y, w: CONTENT_W, h: leadH,
        font: "body", fontSize: leadFit.fontSize, lineHeight: C.lead.lineHeight, paragraphGap: 0,
        color: "text.secondary", paragraphs: leadParas,
      }),
    );
    warnings.push(...warn(slide.id, "lead", leadFit, "Lead line"));
    y += leadH;
  }

  y += C.body.gapAbove;
  const bodyTop = y;
  const availH = BODY_BOTTOM - bodyTop;
  const bodyW = slide.aside ? CONTENT_W - C.aside.gap - C.aside.w : CONTENT_W;

  // Bullets
  const bulletParas: Paragraph[] = slide.bullets.map(text => ({ text, bullet: true }));
  const gapFor = (size: number) => Math.round(size * C.body.gapEm * 10) / 10;
  const bodyFit = fitBodyFont(bulletParas, {
    width: bodyW,
    height: availH,
    maxSize: C.body.maxSize,
    minSize: C.body.minSize,
    warnBelow: C.body.warnBelow,
    lineHeight: C.body.lineHeight,
    paragraphGap: gapFor(C.body.maxSize),
    gapFor,
  });
  elements.push(
    textEl({
      id: "body", x, y: bodyTop, w: bodyW, h: availH,
      font: "body", fontSize: bodyFit.fontSize, lineHeight: C.body.lineHeight, paragraphGap: gapFor(bodyFit.fontSize),
      color: "text.secondary", paragraphs: bulletParas,
    }),
  );
  warnings.push(...warn(slide.id, "body", bodyFit, "Bullet list"));

  // Aside panel
  if (slide.aside) {
    const A = C.aside;
    const panelX = x + bodyW + A.gap;
    const innerX = panelX + A.stripe + A.pad;
    const innerW = A.w - A.stripe - A.pad * 2;
    const labelH = Math.ceil(A.labelSize * 1.2);
    const asideBodyMaxH = availH - A.pad * 2 - labelH - A.labelGap;

    const asideParas: Paragraph[] = [{ text: slide.aside.body }];
    const asideFit = fitFont(asideParas, {
      width: innerW,
      height: asideBodyMaxH,
      font: "body",
      maxSize: A.maxSize,
      minSize: A.minSize,
      lineHeight: A.lineHeight,
      paragraphGap: 0,
    });
    const asideBodyH = Math.min(asideFit.height, asideBodyMaxH);
    const panelH = Math.min(A.pad * 2 + labelH + A.labelGap + asideBodyH, availH);

    elements.push(
      { kind: "rect", id: "aside.panel", x: panelX, y: bodyTop, w: A.w, h: panelH, fill: "panel", radius: A.radius },
      { kind: "rect", id: "aside.stripe", x: panelX, y: bodyTop, w: A.stripe, h: panelH, fill: "accent.primary", radius: 0 },
      textEl({
        id: "aside.label", x: innerX, y: bodyTop + A.pad, w: innerW, h: labelH,
        font: "body", fontSize: A.labelSize, lineHeight: 1.2, paragraphGap: 0,
        color: "accent.primary", uppercase: true, letterSpacing: 1,
        paragraphs: [{ text: slide.aside.label, bold: true }],
      }),
      textEl({
        id: "aside.body", x: innerX, y: bodyTop + A.pad + labelH + A.labelGap, w: innerW, h: asideBodyH,
        font: "body", fontSize: asideFit.fontSize, lineHeight: A.lineHeight, paragraphGap: 0,
        color: "text.primary", paragraphs: asideParas,
      }),
    );
    warnings.push(...warn(slide.id, "aside.body", asideFit, "Aside panel"));
  }

  return { slideId: slide.id, background: "surface", dark: false, elements, warnings, notes: slide.notes };
}
