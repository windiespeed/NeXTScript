/**
 * Renders a `PresentationAST` (see types/slideAst.ts) as a `.pptx` file using PptxGenJS —
 * replaces the old Google Slides API renderer (removed from lib/google.ts). Pure function: no
 * Google auth/API calls happen here, only in lib/google.ts's uploadPptxToDrive().
 *
 * Mirrors the 5-layout structure of components/slides/SlideRenderer.tsx and the theme system in
 * lib/themes.ts. Coordinates are kept in the same pt-based 720×405 (16:9) canvas the old Slides
 * renderer used, converted to inches (÷72) at the point of each PptxGenJS call — PptxGenJS's
 * built-in LAYOUT_16x9 is exactly 10in × 5.625in, so the geometry carries over unchanged.
 */

import PptxGenJS from "pptxgenjs";
import { getTheme } from "@/lib/themes";
import { stripBullets } from "@/lib/google";
import type {
  PresentationAST,
  SlideNode,
  StandardTextSlide,
  SplitColumnSlide,
  CodeExplainerSlide,
  CalloutCardSlide,
  StepGridSlide,
} from "@/types/slideAst";

const PAGE_W = 720; // pt
const PAGE_H = 405; // pt
const MARGIN = 40; // pt
const CONTENT_W = PAGE_W - MARGIN * 2;

/** pt → inches, PptxGenJS's native unit for position/size. */
const IN = (pt: number) => pt / 72;

// Code panels always render dark regardless of theme — mirrors the browser preview's own
// convention (components/slides/CodeExplainerSlide.tsx hardcodes #0d1117 the same way).
const CODE_PANEL_BG = "0d1117";
const CODE_LABEL = "999ea8";
const WHITE = "ffffff";

// The callout panel itself is always filled with a light pastel tint of the variant's accent
// color, regardless of theme — a solid shape fill can't reproduce the browser's alpha-composited
// accent-over-themed-card look, so the panel is intentionally light-on-any-theme instead. Text
// drawn on it must therefore stay dark for contrast; the theme's own text colors (near-white on
// dark themes) would be illegible here.
const CALLOUT_TEXT_PRIMARY = "1f2937";
const CALLOUT_TEXT_SECONDARY = "4b5563";

type Palette = {
  pageBackground: string;
  accentCyan: string;
  accentOrange: string;
  accentPurple: string;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
};

function paletteForTheme(themeId: string): Palette {
  const theme = getTheme(themeId);
  const hex = (h: string) => h.replace("#", "");
  return {
    pageBackground: hex(theme.background.page),
    accentCyan: hex(theme.accent.primary),
    accentOrange: hex(theme.accent.secondary),
    accentPurple: hex(theme.accent.tertiary),
    textPrimary: hex(theme.text.primary),
    textSecondary: hex(theme.text.secondary),
    cardBg: hex(theme.background.cardAlt),
  };
}

/** Blends a hex color toward white — mirrors components/slides/CalloutSlide.tsx's ~10% opacity
 * tint technique in the browser (`${accent}1a`), since a solid shape fill has no alpha. */
function tint(h: string, amount: number): string {
  const n = parseInt(h, 16);
  const blend = (c: number) => Math.round(c + (255 - c) * amount);
  const r = blend((n >> 16) & 0xff);
  const g = blend((n >> 8) & 0xff);
  const b = blend(n & 0xff);
  return [r, g, b].map(c => c.toString(16).padStart(2, "0")).join("");
}

/** Title (+ optional subtitle) header shared by every slide type. Returns the y-coordinate (pt) content should start at. */
function titleHeader(slide: PptxGenJS.Slide, title: string, subtitle: string | undefined, palette: Palette): number {
  slide.addText(title, {
    x: IN(MARGIN), y: IN(28), w: IN(CONTENT_W), h: IN(50),
    bold: true, fontSize: 22, color: palette.textPrimary, valign: "top",
  });

  let y = 80;
  if (subtitle) {
    slide.addText(subtitle, {
      x: IN(MARGIN), y: IN(y), w: IN(CONTENT_W), h: IN(24),
      italic: true, fontSize: 13, color: palette.textSecondary, valign: "top",
    });
    y += 30;
  }

  return y + 6;
}

function standardSlide(pptx: PptxGenJS, node: StandardTextSlide, palette: Palette) {
  const slide = pptx.addSlide();
  slide.background = { color: palette.pageBackground };
  const contentStartY = titleHeader(slide, node.title, node.subtitle, palette);

  const paragraphs = node.paragraphs.map(p => p.trim()).filter(Boolean);
  const bullets = (node.bulletPoints ?? []).map(stripBullets).filter(Boolean);

  const runs: PptxGenJS.TextProps[] = [];
  paragraphs.forEach((p, i) => {
    runs.push({ text: p, options: { breakLine: true } });
    if (i < paragraphs.length - 1) runs.push({ text: "", options: { breakLine: true } });
  });
  if (paragraphs.length > 0 && bullets.length > 0) runs.push({ text: "", options: { breakLine: true } });
  bullets.forEach((b, i) => runs.push({ text: b, options: { bullet: true, breakLine: i < bullets.length - 1 } }));

  if (runs.length > 0) {
    const bodyH = PAGE_H - contentStartY - MARGIN;
    slide.addText(runs, {
      x: IN(MARGIN), y: IN(contentStartY), w: IN(CONTENT_W), h: IN(bodyH),
      fontSize: 13, color: palette.textSecondary, valign: "top",
    });
  }
}

function splitColumnSlide(pptx: PptxGenJS, node: SplitColumnSlide, palette: Palette) {
  const slide = pptx.addSlide();
  slide.background = { color: palette.pageBackground };
  const contentStartY = titleHeader(slide, node.title, node.subtitle, palette);

  const gap = 20;
  const colWidth = (CONTENT_W - gap) / 2;
  const colHeight = PAGE_H - contentStartY - MARGIN;

  function column(x: number, heading: string, content: string[], accent: string) {
    const items = content.map(stripBullets).filter(Boolean);
    const runs: PptxGenJS.TextProps[] = [
      { text: heading.toUpperCase(), options: { bold: true, color: accent, breakLine: true } },
    ];
    items.forEach((item, i) => runs.push({ text: item, options: { color: palette.textSecondary, bullet: true, breakLine: i < items.length - 1 } }));

    slide.addText(runs, {
      shape: pptx.ShapeType.roundRect, fill: { color: palette.cardBg }, line: { type: "none" }, rectRadius: 0.06,
      x: IN(x), y: IN(contentStartY), w: IN(colWidth), h: IN(colHeight),
      fontSize: 12, valign: "top", margin: 10,
    });
  }

  column(MARGIN, node.leftColumn.heading, node.leftColumn.content, palette.accentCyan);
  column(MARGIN + colWidth + gap, node.rightColumn.heading, node.rightColumn.content, palette.accentOrange);
}

function codeExplainerSlide(pptx: PptxGenJS, node: CodeExplainerSlide, palette: Palette) {
  const slide = pptx.addSlide();
  slide.background = { color: palette.pageBackground };
  const contentStartY = titleHeader(slide, node.title, node.subtitle, palette);

  const gap = 20;
  const colWidth = (CONTENT_W - gap) / 2;
  const colHeight = PAGE_H - contentStartY - MARGIN;

  // Code panel — dark fill + monospace text, mirroring the React CodeExplainerSlide's code panel.
  const langLabel = node.language.toUpperCase();
  slide.addText(
    [
      { text: langLabel, options: { bold: true, color: CODE_LABEL, breakLine: true } },
      { text: node.codeSnippet, options: {} },
    ],
    {
      x: IN(MARGIN), y: IN(contentStartY), w: IN(colWidth), h: IN(colHeight),
      fill: { color: CODE_PANEL_BG }, line: { type: "none" },
      fontFace: "Courier New", fontSize: 12, color: WHITE, valign: "top", margin: 10,
    }
  );

  // Explanation column
  const explHeading = "EXPLANATION";
  const points = node.explanationPoints.map(stripBullets).filter(Boolean);
  const explRuns: PptxGenJS.TextProps[] = [
    { text: explHeading, options: { bold: true, color: palette.accentCyan, breakLine: true } },
  ];
  points.forEach((p, i) => explRuns.push({ text: p, options: { color: palette.textSecondary, bullet: true, breakLine: i < points.length - 1 } }));

  slide.addText(explRuns, {
    x: IN(MARGIN + colWidth + gap), y: IN(contentStartY), w: IN(colWidth), h: IN(colHeight),
    fontSize: 12, valign: "top",
  });
}

// Variant→accent-slot mapping mirrors components/slides/CalloutSlide.tsx's own convention exactly
// (tip→primary, warning→secondary, instructor-note→tertiary). Backgrounds are a light tint of
// that same accent rather than a fixed pastel constant, so callouts stay legible on dark themes.
function calloutVariants(palette: Palette): Record<CalloutCardSlide["variant"], { label: string; accent: string; bg: string }> {
  return {
    warning:            { label: "HEADS UP",       accent: palette.accentOrange, bg: tint(palette.accentOrange, 0.9) },
    tip:                { label: "PRO TIP",         accent: palette.accentCyan,   bg: tint(palette.accentCyan, 0.9) },
    "instructor-note":  { label: "INSTRUCTOR NOTE", accent: palette.accentPurple, bg: tint(palette.accentPurple, 0.9) },
  };
}

function calloutSlide(pptx: PptxGenJS, node: CalloutCardSlide, palette: Palette) {
  const slide = pptx.addSlide();
  slide.background = { color: palette.pageBackground };
  const config = calloutVariants(palette)[node.variant];

  const panelX = 80, panelY = 55, panelW = PAGE_W - 160, panelH = PAGE_H - 110;

  const runs: PptxGenJS.TextProps[] = [
    { text: config.label, options: { bold: true, fontSize: 12, color: config.accent, align: "center", breakLine: true } },
    { text: "", options: { breakLine: true } },
    { text: node.title, options: { bold: true, fontSize: 22, color: CALLOUT_TEXT_PRIMARY, align: "center", breakLine: true } },
  ];
  if (node.subtitle) {
    runs.push(
      { text: "", options: { breakLine: true } },
      { text: node.subtitle, options: { italic: true, fontSize: 13, color: CALLOUT_TEXT_SECONDARY, align: "center", breakLine: true } },
    );
  }
  runs.push(
    { text: "", options: { breakLine: true } },
    { text: node.content, options: { fontSize: 14, color: CALLOUT_TEXT_PRIMARY, align: "center" } },
  );

  slide.addText(runs, {
    shape: pptx.ShapeType.roundRect, fill: { color: config.bg }, line: { type: "none" }, rectRadius: 0.06,
    x: IN(panelX), y: IN(panelY), w: IN(panelW), h: IN(panelH),
    valign: "top", margin: 20,
  });
}

function stepGridSlide(pptx: PptxGenJS, node: StepGridSlide, palette: Palette) {
  const slide = pptx.addSlide();
  slide.background = { color: palette.pageBackground };
  const contentStartY = titleHeader(slide, node.title, node.subtitle, palette);

  const steps = [...node.steps].sort((a, b) => a.stepNumber - b.stepNumber);
  if (steps.length === 0) return;

  const cols = Math.min(3, steps.length);
  const rows = Math.ceil(steps.length / cols);
  const gap = 16;
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
  const availableH = PAGE_H - contentStartY - MARGIN;
  const cardH = (availableH - gap * (rows - 1)) / rows;

  steps.forEach((step, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gap);
    const y = contentStartY + row * (cardH + gap);
    const heading = `${step.stepNumber}. ${step.title}`;

    slide.addText(
      [
        { text: heading, options: { bold: true, color: palette.textPrimary, breakLine: true } },
        { text: step.description, options: { color: palette.textSecondary } },
      ],
      {
        shape: pptx.ShapeType.roundRect, fill: { color: palette.cardBg }, line: { type: "none" }, rectRadius: 0.06,
        x: IN(x), y: IN(y), w: IN(cardW), h: IN(cardH),
        fontSize: 12, valign: "top", margin: 10,
      }
    );
  });
}

/** Routes a single AST node to its slide builder — mirrors the exhaustive switch in components/slides/SlideRenderer.tsx. */
function addSlideForNode(pptx: PptxGenJS, node: SlideNode, palette: Palette): void {
  switch (node.type) {
    case "standard": return standardSlide(pptx, node, palette);
    case "split-column": return splitColumnSlide(pptx, node, palette);
    case "code-explainer": return codeExplainerSlide(pptx, node, palette);
    case "callout": return calloutSlide(pptx, node, palette);
    case "step-grid": return stepGridSlide(pptx, node, palette);
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

/** Renders a `PresentationAST` to a .pptx file buffer, ready to upload via lib/google.ts's uploadPptxToDrive(). */
export async function buildPptxFromAst(ast: PresentationAST, themeId: string): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  const palette = paletteForTheme(themeId);

  for (const node of ast.slides) {
    addSlideForNode(pptx, node, palette);
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
