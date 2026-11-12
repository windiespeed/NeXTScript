/**
 * Learns a template's look from its actual slides.
 *
 * Many course decks are styled slide by slide: each slide has its own background color, and its
 * text has fonts and colors set directly, while the master and layouts stay Google's defaults
 * (white, Arial, Office blue). Reading only the master (inspectTemplate) misses all of that, and
 * the export looks nothing like the deck. This reads the slides themselves:
 *
 * - "content" style: the most common slide background, the title and body text on those slides,
 *   accent colors (colored labels and headings), and the fill of panels and cards.
 * - "cover" style: the first slide's look when its background differs (the title slide), and any
 *   other slide with that background (section dividers). The deck's dark slide types (title,
 *   section, callout, closing) are drawn in it.
 *
 * Slides API can't read or write gradient fills, and decks often paint their background with a
 * full-slide gradient shape (or image). So each style also names a "backdrop": a template slide
 * and its full-slide, text-free elements. The exporter duplicates that slide, keeps only those
 * elements, and draws on top, so gradients and background art carry over exactly. Logos and other
 * chrome (visual elements in the same spot on most slides of that style) are kept the same way.
 *
 * It also notices the small text a deck repeats on its slides: a label above the title ("PART 1 ·
 * SQL VS NOSQL") and a footer line. The generator writes that text; the template decides whether it
 * appears and in what color and size.
 *
 * Every color is a plain RGB hex, resolved through the master's color scheme where the deck uses
 * theme colors. Pure: takes presentations.get output, no network.
 */

import type { slides_v1 } from "googleapis";
import type { ColorToken } from "../layout/types";

type Page = slides_v1.Schema$Page;

export interface LearnedPalette {
  background: string;
  title: string;
  body: string;
  muted: string;
  accent1: string;
  accent2: string;
  accent3: string;
  panel: string;
}

/** A template slide whose background elements are reused under new slides. */
export interface Backdrop {
  slideId: string;
  /** Top-level elements to keep: full-slide shapes or images with no text. */
  keep: string[];
  /** Every other top-level element, deleted from the copy. */
  drop: string[];
}

/** How a template draws a repeated small text line (a label or footer). */
export interface Decoration {
  color: string;
  /** Font size in pt. */
  size: number;
  bold: boolean;
}

export interface LearnedStyle {
  /** Present only when the template's content slides have a label above the title. */
  label?: Decoration;
  /** Present only when the template's slides have a footer line. */
  footer?: Decoration;
  content: LearnedPalette;
  cover: LearnedPalette;
  contentBackdrop?: Backdrop;
  coverBackdrop?: Backdrop;
  headingFont?: string;
  bodyFont?: string;
}

// ─── Color helpers ───────────────────────────────────────────────────────────

const hex2 = (v: number | null | undefined) => Math.round(Math.max(0, Math.min(1, v ?? 0)) * 255).toString(16).padStart(2, "0");

function rgbHex(c: slides_v1.Schema$RgbColor | undefined | null): string {
  return `#${hex2(c?.red)}${hex2(c?.green)}${hex2(c?.blue)}`.toUpperCase();
}

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function saturation(hex: string): number {
  const [r, g, b] = channels(hex).map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function distance(a: string, b: string): number {
  const [p, q] = [channels(a), channels(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

function mix(a: string, b: string, t: number): string {
  const [p, q] = [channels(a), channels(b)];
  return `#${p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Readable text on `bg`: white or near-black. */
function onColor(bg: string): string {
  return luminance(bg) < 0.4 ? "#FFFFFF" : "#1F2328";
}

// ─── Reading the presentation ────────────────────────────────────────────────

type Scheme = Map<string, string>;

function colorScheme(page: Page | undefined): Scheme {
  const out: Scheme = new Map();
  for (const c of page?.pageProperties?.colorScheme?.colors ?? []) {
    if (c.type && c.color) out.set(c.type, rgbHex(c.color));
  }
  return out;
}

function resolve(color: slides_v1.Schema$OpaqueColor | undefined | null, scheme: Scheme): string | undefined {
  if (!color) return undefined;
  if (color.rgbColor) return rgbHex(color.rgbColor);
  if (color.themeColor) return scheme.get(color.themeColor);
  return undefined;
}

function pageBackground(page: Page | undefined, scheme: Scheme): string | undefined {
  const fill = page?.pageProperties?.pageBackgroundFill;
  if (!fill || fill.propertyState === "NOT_RENDERED") return undefined;
  return resolve(fill.solidFill?.color, scheme);
}

interface Run {
  text: string;
  font?: string;
  size?: number;
  color?: string;
  bold: boolean;
}

const MONO = /mono|courier|consolas|menlo|code/i;

function runsOf(el: slides_v1.Schema$PageElement, scheme: Scheme): Run[] {
  const nested = el.elementGroup?.children?.flatMap(c => runsOf(c, scheme)) ?? [];
  const own = (el.shape?.text?.textElements ?? [])
    .map(t => t.textRun)
    .filter((r): r is slides_v1.Schema$TextRun => !!r?.content?.trim())
    .map(r => ({
      text: r.content!.trim(),
      font: r.style?.weightedFontFamily?.fontFamily ?? r.style?.fontFamily ?? undefined,
      size: r.style?.fontSize?.magnitude ?? undefined,
      color: resolve(r.style?.foregroundColor?.opaqueColor, scheme),
      bold: !!r.style?.bold,
    }));
  return [...own, ...nested];
}

interface Fill {
  color: string;
  area: number;
}

function fillsOf(el: slides_v1.Schema$PageElement, scheme: Scheme): Fill[] {
  const nested = el.elementGroup?.children?.flatMap(c => fillsOf(c, scheme)) ?? [];
  const props = el.shape?.shapeProperties?.shapeBackgroundFill;
  const color = props && props.propertyState !== "NOT_RENDERED" ? resolve(props.solidFill?.color, scheme) : undefined;
  const w = (el.size?.width?.magnitude ?? 0) * Math.abs(el.transform?.scaleX ?? 1);
  const h = (el.size?.height?.magnitude ?? 0) * Math.abs(el.transform?.scaleY ?? 1);
  return color ? [{ color, area: w * h }, ...nested] : nested;
}

/** The key with the largest total weight. */
function top<K>(weights: Map<K, number>): K | undefined {
  let best: K | undefined;
  let max = -Infinity;
  for (const [k, w] of weights) {
    if (w > max) {
      best = k;
      max = w;
    }
  }
  return best;
}

function add<K>(m: Map<K, number>, k: K | undefined, w: number) {
  if (k !== undefined) m.set(k, (m.get(k) ?? 0) + w);
}

interface Tally {
  titleFont: Map<string, number>;
  titleColor: Map<string, number>;
  bodyFont: Map<string, number>;
  bodyColor: Map<string, number>;
  /** Colors of short labels and headings that aren't the body color. */
  accents: Map<string, number>;
  panels: Map<string, number>;
}

const newTally = (): Tally => ({ titleFont: new Map(), titleColor: new Map(), bodyFont: new Map(), bodyColor: new Map(), accents: new Map(), panels: new Map() });

function tallySlide(slide: Page, bg: string, scheme: Scheme, t: Tally, pageH: number) {
  // Labels and footers are learned on their own, so they don't count toward the body text.
  const deco = decorationsOf(linesOf(slide, scheme, pageH));
  const skip = new Set([deco.label?.text, deco.footer?.text].filter(Boolean));
  const allRuns = (slide.pageElements ?? []).flatMap(e => runsOf(e, scheme));
  const runs = (slide.pageElements ?? [])
    .filter(e => !skip.has(runsOf(e, scheme).map(r => r.text).join(" ")))
    .flatMap(e => runsOf(e, scheme));
  const sized = runs.filter(r => r.size);
  const titleSize = Math.max(0, ...sized.map(r => r.size!));
  for (const r of runs) {
    const isTitle = titleSize > 0 && r.size === titleSize;
    if (isTitle) {
      add(t.titleFont, r.font, r.text.length);
      add(t.titleColor, r.color, r.text.length);
    } else if (!MONO.test(r.font ?? "")) {
      add(t.bodyFont, r.font, r.text.length);
      add(t.bodyColor, r.color, r.text.length);
    }
  }
  // Accents: colored, saturated text that stands out from the background (labels, kickers).
  for (const r of allRuns) {
    if (!r.color || MONO.test(r.font ?? "") || saturation(r.color) < 0.3 || contrast(r.color, bg) < 2) continue;
    add(t.accents, r.color, 1);
  }
  for (const f of (slide.pageElements ?? []).flatMap(e => fillsOf(e, scheme))) {
    if (distance(f.color, bg) < 6) continue;
    add(t.panels, f.color, 1);
  }
}

function palette(t: Tally, bg: string, fallback?: LearnedPalette): LearnedPalette {
  const readable = (c: string | undefined, min: number) => (c && contrast(c, bg) >= min ? c : undefined);
  const title = readable(top(t.titleColor), 3) ?? fallback?.title ?? onColor(bg);
  const body = readable(top(t.bodyColor), 3) ?? fallback?.body ?? onColor(bg);
  const accents = [...t.accents.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const distinct: string[] = [];
  for (const c of [...accents, ...(fallback ? [fallback.accent1, fallback.accent2, fallback.accent3] : [])]) {
    if (contrast(c, bg) >= 2 && distinct.every(d => distance(d, c) > 40)) distinct.push(c);
  }
  const accent1 = distinct[0] ?? title;
  // Panels: the commonest fill that sits close to the background (cards), not a loud block.
  const panels = [...t.panels.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).filter(c => contrast(c, bg) < 2.5 && contrast(body, c) >= 3);
  return {
    background: bg,
    title,
    body,
    muted: mix(body, bg, 0.35),
    accent1,
    accent2: distinct[1] ?? accent1,
    accent3: distinct[2] ?? distinct[1] ?? accent1,
    panel: panels[0] ?? fallback?.panel ?? mix(bg, onColor(bg), 0.08),
  };
}

function extent(el: slides_v1.Schema$PageElement): number {
  const w = (el.size?.width?.magnitude ?? 0) * Math.abs(el.transform?.scaleX ?? 1);
  const h = (el.size?.height?.magnitude ?? 0) * Math.abs(el.transform?.scaleY ?? 1);
  return w * h;
}

const TOP_BAND = 0.2;
const BOTTOM_BAND = 0.82;

interface Line {
  y: number;
  run: Run;
}

/** Top-level text boxes of a slide with their top edge (as a share of page height) and first run. */
function linesOf(slide: Page, scheme: Scheme, pageH: number): Line[] {
  const out: Line[] = [];
  for (const el of slide.pageElements ?? []) {
    const run = el.shape ? runsOf(el, scheme)[0] : undefined;
    if (!run || !pageH) continue;
    out.push({ y: (el.transform?.translateY ?? 0) / pageH, run: { ...run, text: runsOf(el, scheme).map(r => r.text).join(" ") } });
  }
  return out;
}

/** Small label lines above the title, and footer lines, on one slide. */
function decorationsOf(lines: Line[]): { label?: Run; footer?: Run } {
  const titleSize = Math.max(0, ...lines.map(l => l.run.size ?? 0));
  const title = lines.find(l => l.run.size === titleSize);
  const small = (l: Line, max: number) => !!l.run.size && l.run.size < titleSize && l.run.size <= 16 && l.run.text.length <= max;
  const label = title && lines.find(l => l !== title && l.y < TOP_BAND && l.y < title.y && small(l, 60));
  const footer = lines.find(l => l.y >= BOTTOM_BAND && small(l, 100));
  return { label: label?.run, footer: footer?.run };
}

/** The common style of a decoration seen on at least a few slides, or undefined. */
function decoration(seen: Run[], slideCount: number): Decoration | undefined {
  if (seen.length < Math.max(2, Math.ceil(slideCount * 0.3))) return undefined;
  const colors = new Map<string, number>();
  const sizes = new Map<number, number>();
  for (const r of seen) {
    add(colors, r.color, 1);
    add(sizes, r.size, 1);
  }
  const color = top(colors);
  const size = top(sizes);
  if (!color || !size) return undefined;
  return { color, size, bold: seen.filter(r => r.bold).length * 2 > seen.length };
}

const hasText = (el: slides_v1.Schema$PageElement) => (el.shape?.text?.textElements ?? []).some(t => t.textRun?.content?.trim());
/** An image, or a shape with no text: something drawn, not written. */
const isVisual = (el: slides_v1.Schema$PageElement) => !!el.image || (!!el.shape && !hasText(el));

/** Where and how big a visual element is, rounded, so the same logo on many slides matches. */
function placeKey(el: slides_v1.Schema$PageElement): string {
  const r = (v: number | null | undefined) => Math.round((v ?? 0) / 50000);
  const w = (el.size?.width?.magnitude ?? 0) * Math.abs(el.transform?.scaleX ?? 1);
  const h = (el.size?.height?.magnitude ?? 0) * Math.abs(el.transform?.scaleY ?? 1);
  return `${el.image ? "img" : "shape"}:${r(el.transform?.translateX)},${r(el.transform?.translateY)},${r(w)},${r(h)}`;
}

/**
 * Template chrome: visual elements near the edges that sit in the same place on most slides (a
 * logo, a corner stripe). One-off pictures and repeated cards in the middle aren't chrome.
 */
export function chromeKeys(slides: Page[], pageW: number, pageH: number): Set<string> {
  // Chrome lives along the edges; a card in the middle that repeats is still content.
  const nearEdge = (el: slides_v1.Schema$PageElement) => {
    if (!pageW || !pageH) return false;
    const w = (el.size?.width?.magnitude ?? 0) * Math.abs(el.transform?.scaleX ?? 1);
    const h = (el.size?.height?.magnitude ?? 0) * Math.abs(el.transform?.scaleY ?? 1);
    const cx = ((el.transform?.translateX ?? 0) + w / 2) / pageW;
    const cy = ((el.transform?.translateY ?? 0) + h / 2) / pageH;
    return cx < 0.15 || cx > 0.85 || cy < 0.15 || cy > 0.85;
  };
  const counts = new Map<string, number>();
  for (const slide of slides) {
    const keys = new Set((slide.pageElements ?? []).filter(el => isVisual(el) && nearEdge(el)).map(placeKey));
    for (const k of keys) add(counts, k, 1);
  }
  const min = Math.max(2, Math.ceil(slides.length * 0.5));
  return new Set([...counts].filter(([, n]) => n >= min).map(([k]) => k));
}

/** A slide's background pieces (full-slide gradients, art) and chrome (logos), if it has any. */
export function backdropOf(slide: Page, pageArea: number, chrome: Set<string> = new Set()): Backdrop | undefined {
  if (!slide.objectId || !pageArea) return undefined;
  const keep: string[] = [];
  const drop: string[] = [];
  for (const el of slide.pageElements ?? []) {
    if (!el.objectId) continue;
    const kept = isVisual(el) && (extent(el) >= pageArea * 0.85 || chrome.has(placeKey(el)));
    (kept ? keep : drop).push(el.objectId);
  }
  return keep.length ? { slideId: slide.objectId, keep, drop } : undefined;
}

/**
 * The style of a template's own slides, or undefined when its slides don't set one (no slide
 * backgrounds or text colors of their own), in which case the master and layouts are the template.
 */
export function learnTemplateStyle(pres: slides_v1.Schema$Presentation): LearnedStyle | undefined {
  const slides = pres.slides ?? [];
  if (!slides.length) return undefined;
  const masters = new Map((pres.masters ?? []).map(m => [m.objectId, m]));
  const layouts = new Map((pres.layouts ?? []).map(l => [l.objectId, l]));
  const firstMaster = pres.masters?.[0];

  const info = slides.map(s => {
    const layout = layouts.get(s.slideProperties?.layoutObjectId ?? "");
    const master = masters.get(s.slideProperties?.masterObjectId ?? "") ?? masters.get(layout?.layoutProperties?.masterObjectId ?? "") ?? firstMaster;
    const scheme = colorScheme(master);
    const own = pageBackground(s, scheme);
    const bg = own ?? pageBackground(layout, scheme) ?? pageBackground(master, scheme) ?? scheme.get("LIGHT1") ?? "#FFFFFF";
    return { slide: s, scheme, bg, own: !!own };
  });

  const ownText = info.some(i => (i.slide.pageElements ?? []).flatMap(e => runsOf(e, i.scheme)).some(r => r.color || r.font));
  if (!info.some(i => i.own) && !ownText) return undefined;

  const counts = new Map<string, number>();
  for (const i of info) add(counts, i.bg, 1);
  const contentBg = top(counts)!;
  const coverBg = info[0].bg !== contentBg ? info[0].bg : undefined;

  const pageH = pres.pageSize?.height?.magnitude ?? 0;
  const content = newTally();
  const cover = newTally();
  for (const i of info) tallySlide(i.slide, i.bg, i.scheme, coverBg && i.bg === coverBg ? cover : content, pageH);

  const contentPalette = palette(content, contentBg);
  const coverPalette = coverBg ? palette(cover, coverBg, contentPalette) : contentPalette;
  // Page size in the same unit as element sizes (EMU from presentations.get).
  const pageArea = (pres.pageSize?.width?.magnitude ?? 0) * (pres.pageSize?.height?.magnitude ?? 0);
  const sameBg = (bgColor: string) => info.filter(i => i.bg === bgColor).map(i => i.slide);
  const firstWith = (bgColor: string) => {
    const chrome = chromeKeys(sameBg(bgColor), pres.pageSize?.width?.magnitude ?? 0, pageH);
    return info.map(i => (i.bg === bgColor ? backdropOf(i.slide, pageArea, chrome) : undefined)).find(Boolean);
  };
  const contentBackdrop = firstWith(contentBg);

  const contentSlides = info.filter(i => i.bg === contentBg);
  const labels = contentSlides.map(i => decorationsOf(linesOf(i.slide, i.scheme, pageH)).label).filter((r): r is Run => !!r);
  const footers = info.map(i => decorationsOf(linesOf(i.slide, i.scheme, pageH)).footer).filter((r): r is Run => !!r);
  return {
    label: decoration(labels, contentSlides.length),
    footer: decoration(footers, info.length),
    content: contentPalette,
    cover: coverPalette,
    contentBackdrop,
    coverBackdrop: coverBg ? firstWith(coverBg) : contentBackdrop,
    headingFont: top(new Map([...content.titleFont, ...cover.titleFont].map(([k]) => [k, (content.titleFont.get(k) ?? 0) + (cover.titleFont.get(k) ?? 0)]))),
    bodyFont: top(content.bodyFont) ?? top(cover.bodyFont),
  };
}

/** A layout color token in a learned style; dark slide types use the cover style. */
export function learnedColor(style: LearnedStyle, token: ColorToken, dark: boolean): string | undefined {
  const p = dark ? style.cover : style.content;
  switch (token) {
    case "surface": return p.background;
    case "panel": return p.panel;
    case "text.primary": return p.title;
    case "text.secondary": return p.body;
    case "text.muted": return p.muted;
    case "accent.primary": return p.accent1;
    case "accent.secondary": return p.accent2;
    case "accent.tertiary": return p.accent3;
    default: return undefined;
  }
}
