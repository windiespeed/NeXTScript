/**
 * Output of the layout registry: positioned, theme-agnostic elements on a fixed 16:9 canvas.
 *
 * Coordinates are points on a 720×405 canvas, exactly
 * PptxGenJS's LAYOUT_16x9 (10in × 5.625in) at 72pt/in. Adapters convert from here:
 *   - pptx: divide by 72 for inches
 *   - HTML preview: percentages of the canvas (x / 720, y / 405), font sizes scaled with width
 *   - Google Slides API: points are native
 *
 * Colors are theme tokens, not hex values, so one layout renders under any ThemeConfig.
 */

export const CANVAS_W = 720;
export const CANVAS_H = 405;

/** Theme color tokens. Adapters resolve them against a ThemeConfig (types/theme.ts). */
export type ColorToken =
  | "surface" // slide background (theme.background.card)
  | "panel" // secondary panel (theme.background.cardAlt)
  | "text.primary"
  | "text.secondary"
  | "text.muted"
  | "accent.primary"
  | "accent.secondary"
  | "accent.tertiary"
  | "code.bg"
  | "code.label" // language tag on the code panel
  | "code.text";

export type FontRole = "heading" | "body" | "code";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Paragraph {
  text: string;
  bullet?: boolean;
  bold?: boolean;
  italic?: boolean;
  /** Overrides the element's color for this paragraph. */
  color?: ColorToken;
}

export interface TextElement extends Box {
  kind: "text";
  /** Stable id within the slide (e.g. "title", "body", "aside.body"); warnings refer to it. */
  id: string;
  font: FontRole;
  fontSize: number;
  /** Line height as a multiple of fontSize. */
  lineHeight: number;
  /** Extra space after each paragraph, in pt. */
  paragraphGap: number;
  color: ColorToken;
  align: "left" | "center" | "right";
  valign: "top" | "middle" | "bottom";
  uppercase?: boolean;
  letterSpacing?: number;
  paragraphs: Paragraph[];
  /** An exact color that wins over `color` (a course template's own cover text). */
  hex?: string;
  /** A font that wins over the theme's font for `font` (a course template's own cover text). */
  fontFamily?: string;
  /** Font weight that wins over the theme's heading weight. */
  weight?: number;
}

export interface RectElement extends Box {
  kind: "rect";
  id: string;
  fill: ColorToken;
  /** Corner radius in pt; 0 for square. */
  radius: number;
}

export type LayoutElement = TextElement | RectElement;

export type WarningSeverity =
  /** Text fit only after shrinking below the layout's preferred size. Worth a look. */
  | "shrunk"
  /** Text does not fit even at the smallest allowed size. Will clip or spill on the slide. */
  | "overflow";

export interface OverflowWarning {
  slideId: string;
  elementId: string;
  severity: WarningSeverity;
  message: string;
}

export interface SlideLayout {
  slideId: string;
  /** Drawn first, covering the whole canvas. */
  background: ColorToken;
  /** True for dark slide types; adapters may swap the palette. */
  dark: boolean;
  /** True for the deck's title slide, which may sit on a template's own title-slide art. */
  cover?: boolean;
  /** Paint order: first element is drawn first (bottom). */
  elements: LayoutElement[];
  warnings: OverflowWarning[];
  /** Speaker notes, passed straight through to adapters. */
  notes: string;
}
