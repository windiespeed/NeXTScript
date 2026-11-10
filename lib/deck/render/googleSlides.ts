/**
 * Google Slides adapter for the layout registry: native Slides API requests, drawn onto a copy of
 * the course's Slides template.
 *
 * Template mode keeps the template's branding instead of painting over it:
 * - Content slides use the template's emptiest layout, so master art (logos, footers) shows through.
 * - Title and section slides use the template's own Title / Section header layouts when it has
 *   them, filling their placeholders, so those slides look exactly like the template.
 * - Colors are the template's theme colors (DARK1, LIGHT2, ACCENT1…), not fixed hex values, so a
 *   template's palette carries through. Code panels stay dark for legibility.
 * - Fonts are read from the template's master title and body placeholders where it sets them.
 *
 * Without a template the same adapter draws with the NeXTScript theme's own colors and fonts.
 * The request building is pure (no network) so it can be tested; `exportDeckToGoogleSlides`
 * does the Drive copy, the batch update, and the speaker notes.
 */

import { google } from "googleapis";
import type { slides_v1 } from "googleapis";
import type { ThemeConfig } from "@/types/theme";
import type { DeckContent, DeckSlide } from "../schema";
import { layoutSlide } from "../layout/registry";
import type { ColorToken, SlideLayout, TextElement } from "../layout/types";
import { CANVAS_H, CANVAS_W } from "../layout/types";
import { CODE_BG, CODE_TEXT, fontFamily, resolvePalette } from "./palette";
import { firstFont } from "./pptx";

type Request = slides_v1.Schema$Request;
type OpaqueColor = slides_v1.Schema$OpaqueColor;

/** What we learned about a template's presentation. */
export interface TemplateInfo {
  /** Layout with the fewest elements; content slides are drawn on it. */
  blankLayoutId?: string;
  /** Layout with a title placeholder and a subtitle (or body) placeholder, for title slides. */
  titleLayout?: PlaceholderLayout;
  /** Layout for section dividers. */
  sectionLayout?: PlaceholderLayout;
  headingFont?: string;
  bodyFont?: string;
  /** Page size in pt, when it isn't the 720×405 the layouts are drawn for. */
  pageW: number;
  pageH: number;
  /** Slides already in the copy, deleted once the new ones are in. */
  existingSlideIds: string[];
}

export interface PlaceholderLayout {
  layoutId: string;
  title: "TITLE" | "CENTERED_TITLE";
  subtitle?: "SUBTITLE" | "BODY";
}

const EMU_PER_PT = 12700;

function toPt(dim: slides_v1.Schema$Dimension | undefined, fallback: number): number {
  if (!dim?.magnitude) return fallback;
  return dim.unit === "EMU" ? dim.magnitude / EMU_PER_PT : dim.magnitude;
}

function placeholderTypes(page: slides_v1.Schema$Page): string[] {
  return (page.pageElements ?? []).map(e => e.shape?.placeholder?.type).filter((t): t is string => !!t);
}

function findPlaceholderLayout(layouts: slides_v1.Schema$Page[], names: RegExp): PlaceholderLayout | undefined {
  for (const l of layouts) {
    const labels = [l.layoutProperties?.name, l.layoutProperties?.displayName].map(n => (n ?? "").trim());
    if (!labels.some(n => names.test(n)) || !l.objectId) continue;
    const types = placeholderTypes(l);
    const title = types.includes("CENTERED_TITLE") ? "CENTERED_TITLE" : types.includes("TITLE") ? "TITLE" : undefined;
    if (!title) continue;
    const subtitle = types.includes("SUBTITLE") ? "SUBTITLE" : types.includes("BODY") ? "BODY" : undefined;
    return { layoutId: l.objectId, title, subtitle };
  }
  return undefined;
}

function placeholderFont(pages: slides_v1.Schema$Page[], types: string[]): string | undefined {
  for (const page of pages) {
    for (const el of page.pageElements ?? []) {
      if (!types.includes(el.shape?.placeholder?.type ?? "")) continue;
      for (const t of el.shape?.text?.textElements ?? []) {
        const f = t.textRun?.style?.fontFamily ?? t.paragraphMarker?.bullet?.bulletStyle?.fontFamily;
        if (f) return f;
      }
    }
  }
  return undefined;
}

/** Reads what the adapter needs from a template presentation (as returned by presentations.get). */
export function inspectTemplate(pres: slides_v1.Schema$Presentation): TemplateInfo {
  const layouts = pres.layouts ?? [];
  const blank = [...layouts].filter(l => l.objectId).sort((a, b) => (a.pageElements?.length ?? 0) - (b.pageElements?.length ?? 0))[0];
  const masters = pres.masters ?? [];
  return {
    blankLayoutId: blank?.objectId ?? undefined,
    // Google's built-in layouts are named TITLE and SECTION_HEADER; custom templates usually
    // keep display names like "Title slide" and "Section header".
    titleLayout: findPlaceholderLayout(layouts, /^title([ _]slide)?$/i),
    sectionLayout: findPlaceholderLayout(layouts, /^section([ _](header|title))?$/i),
    headingFont: placeholderFont([...masters, ...layouts], ["TITLE", "CENTERED_TITLE"]),
    bodyFont: placeholderFont([...masters, ...layouts], ["BODY", "SUBTITLE"]),
    pageW: toPt(pres.pageSize?.width, CANVAS_W),
    pageH: toPt(pres.pageSize?.height, CANVAS_H),
    existingSlideIds: (pres.slides ?? []).map(s => s.objectId!).filter(Boolean),
  };
}

// ─── Colors and fonts ────────────────────────────────────────────────────────

function rgb(hexColor: string): OpaqueColor {
  const h = hexColor.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, c => c + c) : h.slice(0, 6), 16);
  return { rgbColor: { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 } };
}

const THEME_LIGHT: Record<ColorToken, string> = {
  surface: "LIGHT1", panel: "LIGHT2",
  "text.primary": "DARK1", "text.secondary": "DARK2", "text.muted": "DARK2",
  "accent.primary": "ACCENT1", "accent.secondary": "ACCENT2", "accent.tertiary": "ACCENT3",
  "code.bg": "", "code.text": "",
};
const THEME_DARK: Record<ColorToken, string> = {
  ...THEME_LIGHT,
  surface: "DARK1", panel: "DARK2",
  "text.primary": "LIGHT1", "text.secondary": "LIGHT2", "text.muted": "LIGHT2",
};

interface Ctx {
  theme: ThemeConfig;
  template?: TemplateInfo;
}

function color(token: ColorToken, dark: boolean, ctx: Ctx): OpaqueColor {
  if (token === "code.bg") return rgb(CODE_BG);
  if (token === "code.text") return rgb(CODE_TEXT);
  if (ctx.template) return { themeColor: (dark ? THEME_DARK : THEME_LIGHT)[token] };
  return rgb(resolvePalette(ctx.theme, dark)[token]);
}

function font(el: TextElement, ctx: Ctx): string {
  if (el.font === "code") return "Roboto Mono";
  const fromTemplate = el.font === "heading" ? ctx.template?.headingFont : ctx.template?.bodyFont;
  return fromTemplate ?? firstFont(fontFamily(ctx.theme, el.font));
}

// ─── Requests ────────────────────────────────────────────────────────────────

/**
 * Text boxes in Slides have built-in padding the API can't change, so boxes grow by this much
 * on each side to keep the text where the layout put it.
 */
const TEXTBOX_INSET = 7.2;

class Ids {
  private n = 0;
  constructor(private readonly prefix: string) {}
  next(kind: string) {
    return `${this.prefix}_${kind}_${(this.n++).toString(36)}`;
  }
}

function transform(pageObjectId: string, x: number, y: number, w: number, h: number, sx: number, sy: number): slides_v1.Schema$PageElementProperties {
  return {
    pageObjectId,
    size: { width: { magnitude: Math.max(1, w * sx), unit: "PT" }, height: { magnitude: Math.max(1, h * sy), unit: "PT" } },
    transform: { scaleX: 1, scaleY: 1, translateX: x * sx, translateY: y * sy, unit: "PT" },
  };
}

function textRequests(el: TextElement, objectId: string, pageId: string, dark: boolean, ctx: Ctx, sx: number, sy: number): Request[] {
  const paragraphs = el.paragraphs.map(p => (el.uppercase ? p.text.toUpperCase() : p.text));
  const text = paragraphs.join("\n");
  const fs = el.fontSize * Math.min(sx, sy);
  const reqs: Request[] = [
    {
      createShape: {
        objectId,
        shapeType: "TEXT_BOX",
        elementProperties: transform(pageId, el.x - TEXTBOX_INSET, el.y - TEXTBOX_INSET, el.w + TEXTBOX_INSET * 2, el.h + TEXTBOX_INSET * 2, sx, sy),
      },
    },
    {
      updateShapeProperties: {
        objectId,
        shapeProperties: { contentAlignment: el.valign === "top" ? "TOP" : el.valign === "middle" ? "MIDDLE" : "BOTTOM" },
        fields: "contentAlignment",
      },
    },
  ];
  if (!text) return reqs;
  reqs.push(
    { insertText: { objectId, insertionIndex: 0, text } },
    {
      updateTextStyle: {
        objectId,
        textRange: { type: "ALL" },
        style: {
          fontFamily: font(el, ctx),
          fontSize: { magnitude: Math.round(fs * 2) / 2, unit: "PT" },
          foregroundColor: { opaqueColor: color(el.color, dark, ctx) },
          bold: el.font === "heading",
        },
        fields: "fontFamily,fontSize,foregroundColor,bold",
      },
    },
    {
      updateParagraphStyle: {
        objectId,
        textRange: { type: "ALL" },
        style: {
          alignment: el.align === "left" ? "START" : el.align === "center" ? "CENTER" : "END",
          lineSpacing: Math.round(el.lineHeight * 100),
          spaceAbove: { magnitude: 0, unit: "PT" },
          spaceBelow: { magnitude: el.paragraphGap * Math.min(sx, sy), unit: "PT" },
        },
        fields: "alignment,lineSpacing,spaceAbove,spaceBelow",
      },
    },
  );

  // Per-paragraph styling and bullets. Ranges are UTF-16 offsets, the same as JS string indices.
  let start = 0;
  el.paragraphs.forEach((p, i) => {
    const end = start + paragraphs[i].length;
    if (end > start) {
      const style: slides_v1.Schema$TextStyle = {};
      const fields: string[] = [];
      if (p.bold) {
        style.bold = true;
        fields.push("bold");
      }
      if (p.italic) {
        style.italic = true;
        fields.push("italic");
      }
      if (p.color) {
        style.foregroundColor = { opaqueColor: color(p.color, dark, ctx) };
        fields.push("foregroundColor");
      }
      if (fields.length) {
        reqs.push({ updateTextStyle: { objectId, textRange: { type: "FIXED_RANGE", startIndex: start, endIndex: end }, style, fields: fields.join(",") } });
      }
      if (p.bullet) {
        reqs.push({ createParagraphBullets: { objectId, textRange: { type: "FIXED_RANGE", startIndex: start, endIndex: end }, bulletPreset: "BULLET_DISC_CIRCLE_SQUARE" } });
      }
    }
    start = end + 1; // the "\n" between paragraphs
  });
  return reqs;
}

function drawnSlide(layout: SlideLayout, pageId: string, ids: Ids, ctx: Ctx, insertionIndex: number): Request[] {
  const dark = layout.dark;
  const sx = (ctx.template?.pageW ?? CANVAS_W) / CANVAS_W;
  const sy = (ctx.template?.pageH ?? CANVAS_H) / CANVAS_H;
  const reqs: Request[] = [
    {
      createSlide: {
        objectId: pageId,
        insertionIndex,
        slideLayoutReference: ctx.template?.blankLayoutId ? { layoutId: ctx.template.blankLayoutId } : { predefinedLayout: "BLANK" },
      },
    },
  ];
  // Light slides on a template keep the template's own background; everything else is filled.
  if (!ctx.template || dark) {
    reqs.push({
      updatePageProperties: {
        objectId: pageId,
        pageProperties: { pageBackgroundFill: { solidFill: { color: color(layout.background, dark, ctx) } } },
        fields: "pageBackgroundFill.solidFill.color",
      },
    });
  }
  for (const el of layout.elements) {
    const objectId = ids.next(el.kind === "rect" ? "r" : "t");
    if (el.kind === "rect") {
      reqs.push(
        {
          createShape: {
            objectId,
            shapeType: el.radius > 0 ? "ROUND_RECTANGLE" : "RECTANGLE",
            elementProperties: transform(pageId, el.x, el.y, el.w, el.h, sx, sy),
          },
        },
        {
          updateShapeProperties: {
            objectId,
            shapeProperties: {
              shapeBackgroundFill: { solidFill: { color: color(el.fill, dark, ctx) } },
              outline: { propertyState: "NOT_RENDERED" },
            },
            fields: "shapeBackgroundFill.solidFill.color,outline.propertyState",
          },
        },
      );
    } else {
      reqs.push(...textRequests(el, objectId, pageId, dark, ctx, sx, sy));
    }
  }
  return reqs;
}

/** Title and section slides on the template's own placeholder layouts. */
function placeholderSlide(slide: Extract<DeckSlide, { type: "title" | "section" }>, layout: PlaceholderLayout, pageId: string, ids: Ids, insertionIndex: number): Request[] {
  const titleId = ids.next("pt");
  const subId = layout.subtitle ? ids.next("ps") : undefined;
  const mappings: slides_v1.Schema$LayoutPlaceholderIdMapping[] = [{ layoutPlaceholder: { type: layout.title }, objectId: titleId }];
  if (layout.subtitle && subId) mappings.push({ layoutPlaceholder: { type: layout.subtitle }, objectId: subId });
  const reqs: Request[] = [
    { createSlide: { objectId: pageId, insertionIndex, slideLayoutReference: { layoutId: layout.layoutId }, placeholderIdMappings: mappings } },
    { insertText: { objectId: titleId, insertionIndex: 0, text: slide.title } },
  ];
  const sub = [slide.kicker, slide.subtitle].filter(Boolean).join(" · ");
  if (subId && sub) reqs.push({ insertText: { objectId: subId, insertionIndex: 0, text: sub } });
  return reqs;
}

export interface BuiltRequests {
  requests: Request[];
  /** Page object id of each new slide, in deck order, for adding speaker notes afterwards. */
  slideIds: string[];
  notes: string[];
}

/** Every request needed to draw the deck, after any slides already in the presentation. */
export function buildSlidesRequests(deck: DeckContent, ctx: Ctx, idPrefix = "nx"): BuiltRequests {
  const ids = new Ids(idPrefix);
  const requests: Request[] = [];
  const slideIds: string[] = [];
  const notes: string[] = [];
  const offset = ctx.template?.existingSlideIds.length ?? 0;

  deck.slides.forEach((slide, i) => {
    const pageId = ids.next("p");
    const index = offset + i;
    const placeholder = slide.type === "title" ? ctx.template?.titleLayout : slide.type === "section" ? ctx.template?.sectionLayout : undefined;
    if (placeholder && (slide.type === "title" || slide.type === "section")) {
      requests.push(...placeholderSlide(slide, placeholder, pageId, ids, index));
    } else {
      requests.push(...drawnSlide(layoutSlide(slide), pageId, ids, ctx, index));
    }
    slideIds.push(pageId);
    notes.push(slide.notes);
  });

  for (const id of ctx.template?.existingSlideIds ?? []) requests.push({ deleteObject: { objectId: id } });
  return { requests, slideIds, notes };
}

// ─── Export ──────────────────────────────────────────────────────────────────

function authClient(accessToken: string) {
  const a = new google.auth.OAuth2();
  a.setCredentials({ access_token: accessToken });
  return a;
}

const BATCH = 400;

/**
 * Creates a native Google Slides deck: a copy of `templateId` when given (its sample slides are
 * removed), otherwise a new presentation in the NeXTScript theme. Returns the new file's id and URL.
 */
export async function exportDeckToGoogleSlides(opts: {
  deck: DeckContent;
  theme: ThemeConfig;
  name: string;
  accessToken: string;
  templateId?: string;
}): Promise<{ id: string; url: string }> {
  const auth = authClient(opts.accessToken);
  const drive = google.drive({ version: "v3", auth });
  const slides = google.slides({ version: "v1", auth });

  let id: string;
  if (opts.templateId) {
    const copy = await drive.files.copy({ fileId: opts.templateId, requestBody: { name: opts.name }, fields: "id", supportsAllDrives: true });
    id = copy.data.id!;
  } else {
    const created = await slides.presentations.create({ requestBody: { title: opts.name } });
    id = created.data.presentationId!;
  }

  const pres = await slides.presentations.get({ presentationId: id });
  const template = opts.templateId ? inspectTemplate(pres.data) : undefined;
  const built = buildSlidesRequests(opts.deck, { theme: opts.theme, template });
  // A new presentation starts with one empty title slide; remove it once the deck is in.
  if (!template) {
    for (const s of pres.data.slides ?? []) if (s.objectId) built.requests.push({ deleteObject: { objectId: s.objectId } });
  }

  for (let i = 0; i < built.requests.length; i += BATCH) {
    await slides.presentations.batchUpdate({ presentationId: id, requestBody: { requests: built.requests.slice(i, i + BATCH) } });
  }

  // Speaker notes: each slide's notes shape only exists once the slide does.
  const after = await slides.presentations.get({
    presentationId: id,
    fields: "slides(objectId,slideProperties(notesPage(notesProperties(speakerNotesObjectId))))",
  });
  const notesShape = new Map((after.data.slides ?? []).map(s => [s.objectId, s.slideProperties?.notesPage?.notesProperties?.speakerNotesObjectId]));
  const noteRequests: Request[] = [];
  built.slideIds.forEach((slideId, i) => {
    const shape = notesShape.get(slideId);
    if (shape && built.notes[i]) noteRequests.push({ insertText: { objectId: shape, insertionIndex: 0, text: built.notes[i] } });
  });
  for (let i = 0; i < noteRequests.length; i += BATCH) {
    await slides.presentations.batchUpdate({ presentationId: id, requestBody: { requests: noteRequests.slice(i, i + BATCH) } });
  }

  return { id, url: `https://docs.google.com/presentation/d/${id}/edit` };
}

/** The presentation id in a Google Slides URL (…/presentation/d/<id>/…), if there is one. */
export function presentationIdFromUrl(url: string | undefined): string | undefined {
  return url?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
}
