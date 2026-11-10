/**
 * pptx adapter for the layout registry: turns SlideLayouts into a .pptx with PptxGenJS.
 *
 * The canvas is the same 720×405 pt space PptxGenJS's LAYOUT_16x9 uses (10in × 5.625in), so
 * positions convert by dividing by 72. Speaker notes go on every slide. Uploading this file to
 * Drive with the Google Slides target type converts it to an editable Slides deck, and the notes
 * survive the conversion.
 */

import PptxGenJS from "pptxgenjs";
import type { ThemeConfig } from "@/types/theme";
import type { DeckContent } from "../schema";
import { layoutSlide } from "../layout/registry";
import type { SlideLayout, TextElement } from "../layout/types";
import { CODE_FONT, fontFamily, resolvePalette } from "./palette";
import type { Palette } from "./palette";

const IN = (pt: number) => pt / 72;
const hex = (color: string) => color.replace("#", "").slice(0, 6);
const BULLET_INDENT_EM = 1.4; // matches lib/deck/layout/fit.ts

/** First family in a CSS font stack, unquoted: "'Inter', 'Segoe UI', sans-serif" → "Inter". */
export function firstFont(stack: string): string {
  const first = stack.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  return first || "Arial";
}

function textRuns(el: TextElement, palette: Palette): PptxGenJS.TextProps[] {
  return el.paragraphs.map((p, i) => {
    const last = i === el.paragraphs.length - 1;
    const text = el.uppercase ? p.text.toUpperCase() : p.text;
    return {
      text,
      options: {
        bold: p.bold || undefined,
        italic: p.italic || undefined,
        color: p.color ? hex(palette[p.color]) : undefined,
        bullet: p.bullet ? { indent: Math.round(el.fontSize * BULLET_INDENT_EM) } : undefined,
        paraSpaceAfter: last ? 0 : el.paragraphGap,
        breakLine: !last,
      },
    };
  });
}

function addLayout(pptx: PptxGenJS, layout: SlideLayout, theme: ThemeConfig) {
  const palette = resolvePalette(theme, layout.dark);
  const slide = pptx.addSlide();
  slide.background = { color: hex(palette[layout.background]) };

  for (const el of layout.elements) {
    const box = { x: IN(el.x), y: IN(el.y), w: IN(el.w), h: IN(el.h) };
    if (el.kind === "rect") {
      const round = el.radius > 0;
      slide.addShape(round ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
        ...box,
        fill: { color: hex(palette[el.fill]) },
        line: { type: "none" },
        // PptxGenJS takes the corner radius as a fraction of the shorter side (0–1).
        ...(round ? { rectRadius: Math.min(0.5, el.radius / Math.min(el.w, el.h)) } : {}),
      });
      continue;
    }
    const face = el.font === "code" ? firstFont(CODE_FONT) : firstFont(fontFamily(theme, el.font));
    slide.addText(textRuns(el, palette), {
      ...box,
      fontFace: face,
      fontSize: el.fontSize,
      color: hex(palette[el.color]),
      bold: el.font === "heading" ? theme.typography.headingWeight >= 600 : undefined,
      align: el.align,
      valign: el.valign,
      lineSpacingMultiple: el.lineHeight,
      charSpacing: el.letterSpacing,
      margin: 0,
      fit: "none",
      wrap: el.font !== "code",
    });
  }

  if (layout.notes) slide.addNotes(layout.notes);
}

/** Lays out and renders a whole deck to a .pptx buffer. */
export async function buildDeckPptx(deck: DeckContent, theme: ThemeConfig): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = deck.lessonTitle;
  for (const slide of deck.slides) addLayout(pptx, layoutSlide(slide), theme);
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
