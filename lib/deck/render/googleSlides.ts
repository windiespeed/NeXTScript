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
 * - Most hand-built decks style each slide directly and leave the master at Google's defaults.
 *   For those, the look is learned from the slides themselves (templateStyle.ts): backgrounds,
 *   fonts, and text, accent and panel colors, and every slide is drawn in that style.
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
import { DECORATION_IDS, FOOTER_Y } from "../layout/decorations";
import { GRID } from "../layout/kit";
import { learnTemplateStyle, learnedColor, type Backdrop, type Decoration, type LearnedFrame, type LearnedStyle } from "./templateStyle";

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
  "code.bg": "", "code.label": "", "code.text": "",
};
const THEME_DARK: Record<ColorToken, string> = {
  ...THEME_LIGHT,
  surface: "DARK1", panel: "DARK2",
  "text.primary": "LIGHT1", "text.secondary": "LIGHT2", "text.muted": "LIGHT2",
};

interface Ctx {
  theme: ThemeConfig;
  template?: TemplateInfo;
  /** The template's look as read from its slides, when they set one (see templateStyle.ts). */
  learned?: LearnedStyle;
}

function color(token: ColorToken, dark: boolean, ctx: Ctx): OpaqueColor {
  if (token === "code.bg") return rgb(CODE_BG);
  if (token === "code.text") return rgb(CODE_TEXT);
  // The code panel is always dark, so its label can't follow the template's accent color.
  if (token === "code.label") return rgb(resolvePalette(ctx.theme, dark)["code.label"]);
  const learned = ctx.learned && learnedColor(ctx.learned, token, dark);
  if (learned) return rgb(learned);
  if (ctx.template) return { themeColor: (dark ? THEME_DARK : THEME_LIGHT)[token] };
  return rgb(resolvePalette(ctx.theme, dark)[token]);
}

/**
 * Fonts Google Slides can render. Anything else (Segoe UI, system-ui) silently falls back to
 * Times New Roman there, so a theme's font stack is walked until one of these turns up.
 */
const SLIDES_FONTS = new Set(
  ["Arial", "Calibri", "Cambria", "Comic Sans MS", "Courier New", "Georgia", "Impact", "Times New Roman", "Trebuchet MS", "Verdana",
    "Inter", "Lato", "Montserrat", "Open Sans", "Poppins", "Raleway", "Roboto", "Roboto Mono", "Source Sans Pro", "Fraunces",
    "Playfair Display", "Merriweather", "Nunito", "Oswald", "PT Sans", "Work Sans", "DM Sans", "Space Grotesk", "Lora"].map(f => f.toLowerCase()),
);

export function slidesFont(stack: string): string {
  const fonts = stack.split(",").map(f => f.trim().replace(/^['"]|['"]$/g, ""));
  return fonts.find(f => SLIDES_FONTS.has(f.toLowerCase())) ?? (/serif/i.test(stack) && !/sans-serif/i.test(stack) ? "Georgia" : "Arial");
}

function font(el: TextElement, ctx: Ctx): string {
  if (el.font === "code") return "Roboto Mono";
  const learned = el.font === "heading" ? ctx.learned?.headingFont : ctx.learned?.bodyFont;
  const fromTemplate = el.font === "heading" ? ctx.template?.headingFont : ctx.template?.bodyFont;
  return learned ?? fromTemplate ?? slidesFont(fontFamily(ctx.theme, el.font));
}

/**
 * Slides can't set a corner radius: a ROUND_RECTANGLE's corners scale with the shape, so a big
 * panel turns into a bubble. Only small shapes (badges, stripes) keep rounded corners.
 */
const MAX_ROUNDED = 28;

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

/**
 * Maps the layout canvas onto the page: page = o + canvas · k. By default the canvas is simply
 * scaled to the page. With a learned frame, the layout's content box (its margins, from the top of
 * the header to the footer line) lands on the template's own content box.
 */
export interface Frame {
  ox: number;
  oy: number;
  kx: number;
  ky: number;
  /** Font scale. */
  k: number;
}

export function pageFrame(pageW: number, pageH: number, learned?: LearnedFrame): Frame {
  if (!learned) {
    const kx = pageW / CANVAS_W;
    const ky = pageH / CANVAS_H;
    return { ox: 0, oy: 0, kx, ky, k: Math.min(kx, ky) };
  }
  const kx = (pageW - learned.left * 2) / GRID.contentW;
  const ky = (learned.footerTop - learned.top) / (FOOTER_Y - GRID.top);
  return { ox: learned.left - GRID.marginX * kx, oy: learned.top - GRID.top * ky, kx, ky, k: Math.min(kx, ky) };
}

function transform(pageObjectId: string, x: number, y: number, w: number, h: number, f: Frame, pad = 0): slides_v1.Schema$PageElementProperties {
  return {
    pageObjectId,
    size: { width: { magnitude: Math.max(1, w * f.kx + pad * 2), unit: "PT" }, height: { magnitude: Math.max(1, h * f.ky + pad * 2), unit: "PT" } },
    transform: { scaleX: 1, scaleY: 1, translateX: f.ox + x * f.kx - pad, translateY: f.oy + y * f.ky - pad, unit: "PT" },
  };
}

function textRequests(el: TextElement, objectId: string, pageId: string, dark: boolean, ctx: Ctx, f: Frame, deco?: Decoration): Request[] {
  const paragraphs = el.paragraphs.map(p => (el.uppercase ? p.text.toUpperCase() : p.text));
  const text = paragraphs.join("\n");
  // A template's label or footer keeps the template's own size and color.
  const fs = deco ? deco.size : el.fontSize * f.k;
  const reqs: Request[] = [
    {
      createShape: {
        objectId,
        shapeType: "TEXT_BOX",
        // Slides pads text boxes by 7.2pt, so the box grows by that much to put the text on the spot.
        elementProperties: transform(pageId, el.x, el.y, el.w, el.h, f, TEXTBOX_INSET),
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
          foregroundColor: { opaqueColor: deco ? rgb(deco.color) : color(el.color, dark, ctx) },
          bold: deco ? deco.bold : el.font === "heading",
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
          spaceBelow: { magnitude: el.paragraphGap * f.k, unit: "PT" },
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
      if (p.bold && !deco) {
        style.bold = true;
        fields.push("bold");
      }
      if (p.italic) {
        style.italic = true;
        fields.push("italic");
      }
      if (p.color && !deco) {
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

/**
 * A copy of a template slide with only its background elements left, moved into place. The Slides
 * API can't create gradient fills, so copying them is the only way to keep them.
 */
function backdropSlide(b: Backdrop, pageId: string, ids: Ids, insertionIndex: number): Request[] {
  const objectIds: Record<string, string> = { [b.slideId]: pageId };
  const dropped = b.drop.map(id => (objectIds[id] = ids.next("x")));
  for (const id of b.keep) objectIds[id] = ids.next("k");
  return [
    { duplicateObject: { objectId: b.slideId, objectIds } },
    ...dropped.map(objectId => ({ deleteObject: { objectId } })),
    // The copy lands right after its source; insertionIndex counts slides before the move, and
    // the copy itself is one of them, so it goes one further to land at `insertionIndex`.
    { updateSlidesPosition: { slideObjectIds: [pageId], insertionIndex: insertionIndex + 1 } },
  ];
}

function drawnSlide(layout: SlideLayout, pageId: string, ids: Ids, ctx: Ctx, insertionIndex: number): Request[] {
  const dark = layout.dark;
  const f = pageFrame(ctx.template?.pageW ?? CANVAS_W, ctx.template?.pageH ?? CANVAS_H, ctx.learned?.frame);
  const backdrop = dark ? ctx.learned?.coverBackdrop : ctx.learned?.contentBackdrop;
  const reqs: Request[] = backdrop
    ? backdropSlide(backdrop, pageId, ids, insertionIndex)
    : [
        {
          createSlide: {
            objectId: pageId,
            insertionIndex,
            slideLayoutReference: ctx.template?.blankLayoutId ? { layoutId: ctx.template.blankLayoutId } : { predefinedLayout: "BLANK" },
          },
        },
      ];
  // Light slides on a template keep the template's own background, unless its look comes from its
  // slides (a learned style), where every slide gets the learned background.
  if (!ctx.template || dark || ctx.learned) {
    reqs.push({
      updatePageProperties: {
        objectId: pageId,
        pageProperties: { pageBackgroundFill: { solidFill: { color: color(layout.background, dark, ctx) } } },
        fields: "pageBackgroundFill.solidFill.color",
      },
    });
  }
  for (const el of layout.elements) {
    // With a learned template, labels and footers appear only if the template has them.
    const decoKind = el.kind === "text" && (el.id === DECORATION_IDS.label ? "label" : el.id === DECORATION_IDS.footer ? "footer" : undefined);
    const deco = decoKind ? ctx.learned?.[decoKind] : undefined;
    if (decoKind && ctx.learned && !deco) continue;
    const objectId = ids.next(el.kind === "rect" ? "r" : "t");
    if (el.kind === "rect") {
      reqs.push(
        {
          createShape: {
            objectId,
            shapeType: el.radius > 0 && Math.min(el.w * f.kx, el.h * f.ky) <= MAX_ROUNDED ? "ROUND_RECTANGLE" : "RECTANGLE",
            elementProperties: transform(pageId, el.x, el.y, el.w, el.h, f),
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
      reqs.push(...textRequests(el, objectId, pageId, dark, ctx, f, deco));
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
    // A template styled slide by slide has plain layouts; its title and section look is learned.
    const layouts = ctx.learned ? undefined : ctx.template;
    const placeholder = slide.type === "title" ? layouts?.titleLayout : slide.type === "section" ? layouts?.sectionLayout : undefined;
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
  const learned = opts.templateId ? learnTemplateStyle(pres.data) : undefined;
  const built = buildSlidesRequests(opts.deck, { theme: opts.theme, template, learned });
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
    fields: "slides(objectId,slideProperties(notesPage(notesProperties(speakerNotesObjectId),pageElements(objectId,shape(text(textElements(textRun(content))))))))",
  });
  const noteRequests: Request[] = [];
  const bySlide = new Map((after.data.slides ?? []).map(s => [s.objectId, s.slideProperties?.notesPage]));
  built.slideIds.forEach((slideId, i) => {
    const page = bySlide.get(slideId);
    const shape = page?.notesProperties?.speakerNotesObjectId;
    if (!shape) return;
    // A slide copied from the template (a backdrop) brings the template's notes along.
    const existing = page?.pageElements?.find(e => e.objectId === shape)?.shape?.text?.textElements?.some(t => t.textRun?.content?.trim());
    if (existing) noteRequests.push({ deleteText: { objectId: shape, textRange: { type: "ALL" } } });
    if (built.notes[i]) noteRequests.push({ insertText: { objectId: shape, insertionIndex: 0, text: built.notes[i] } });
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
