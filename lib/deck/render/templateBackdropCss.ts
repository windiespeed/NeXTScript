/**
 * The background art of a course template's slides as CSS, so the in-browser preview can show
 * the gradients the Google Slides export copies.
 *
 * The Slides API doesn't expose gradient fills, so the export keeps them by duplicating template
 * slides (see templateStyle.ts, Backdrop). For the preview we need the actual colors: Drive can
 * export the template as .pptx, where gradients are plain DrawingML. This reads a slide's
 * full-slide, text-free shapes (and its own background) and turns them into CSS background layers.
 *
 * Pure apart from JSZip: takes the .pptx bytes, no network.
 */

import JSZip from "jszip";

/** CSS for one slide's backdrop: `background-image` layers (top first) and a base color. */
export interface BackdropCss {
  image: string;
  color?: string;
}

const attr = (xml: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(xml)?.[1];

/** DrawingML percentages are either "50%" or thousandths of a percent ("50000"). */
function pct(v: string | undefined): number {
  if (!v) return 0;
  return v.endsWith("%") ? parseFloat(v) : parseInt(v, 10) / 1000;
}

/** A DrawingML color element (srgbClr only; theme colors are skipped) as CSS. */
function cssColor(xml: string): string | undefined {
  const m = /<a:srgbClr val="([0-9A-Fa-f]{6})"\s*(\/>|>([\s\S]*?)<\/a:srgbClr>)/.exec(xml);
  if (!m) return undefined;
  const hex = m[1].toUpperCase();
  const alpha = m[3] ? /<a:alpha val="(\d+)"/.exec(m[3])?.[1] : undefined;
  if (alpha === undefined || parseInt(alpha, 10) >= 100000) return `#${hex}`;
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${(parseInt(alpha, 10) / 100000).toFixed(3)})`;
}

/** A `<a:gradFill>` as a CSS gradient, or undefined if its colors can't be read. */
export function gradientCss(gradFill: string): string | undefined {
  const stops: string[] = [];
  for (const gs of gradFill.matchAll(/<a:gs pos="(\d+)">([\s\S]*?)<\/a:gs>/g)) {
    const c = cssColor(gs[2]);
    if (!c) return undefined;
    stops.push(`${c} ${(parseInt(gs[1], 10) / 1000).toFixed(1).replace(/\.0$/, "")}%`);
  }
  if (stops.length < 2) return undefined;
  const lin = /<a:lin\b[^>]*>/.exec(gradFill)?.[0];
  if (lin) {
    // DrawingML angles run clockwise from "left to right"; CSS's 0deg points up.
    const ang = parseInt(attr(lin, "ang") ?? "0", 10) / 60000;
    return `linear-gradient(${Math.round((ang + 90) % 360)}deg, ${stops.join(", ")})`;
  }
  const path = /<a:path\b[^>]*>([\s\S]*?)<\/a:path>|<a:path\b[^>]*\/>/.exec(gradFill);
  if (path) {
    // The focus is the fillToRect, given as insets from each side; stop 0 sits at the focus.
    const rect = /<a:fillToRect\b[^>]*\/?>/.exec(path[0])?.[0] ?? "";
    const x = (pct(attr(rect, "l")) + 100 - pct(attr(rect, "r"))) / 2;
    const y = (pct(attr(rect, "t")) + 100 - pct(attr(rect, "b"))) / 2;
    const shape = attr(path[0], "path") === "circle" ? "circle" : "ellipse";
    return `radial-gradient(${shape} farthest-corner at ${+x.toFixed(1)}% ${+y.toFixed(1)}%, ${stops.join(", ")})`;
  }
  return undefined;
}

/** A fill (`<a:gradFill>` or `<a:solidFill>`) inside `xml` as a CSS image layer. */
function fillLayer(xml: string): string | undefined {
  const grad = /<a:gradFill\b[\s\S]*?<\/a:gradFill>/.exec(xml)?.[0];
  if (grad) return gradientCss(grad);
  const solid = /<a:solidFill>([\s\S]*?)<\/a:solidFill>/.exec(xml)?.[1];
  const c = solid ? cssColor(solid) : undefined;
  return c ? `linear-gradient(${c}, ${c})` : undefined;
}

/** Top-level `<p:sp>` shapes of a slide's shape tree, in drawing order (bottom first). */
function topLevelShapes(slideXml: string): string[] {
  const tree = /<p:spTree>([\s\S]*)<\/p:spTree>/.exec(slideXml)?.[1] ?? "";
  const shapes: string[] = [];
  // Walk the tree, skipping groups, so shapes inside a group aren't taken for full-slide ones.
  const re = /<p:(sp|grpSp|pic|graphicFrame|cxnSp)\b[\s\S]*?<\/p:\1>/g;
  for (const m of tree.matchAll(re)) if (m[1] === "sp") shapes.push(m[0]);
  return shapes;
}

/** The backdrop of one slide (its own background plus full-slide, text-free shapes) as CSS. */
export function slideBackdropCss(slideXml: string, slideW: number, slideH: number): BackdropCss | undefined {
  const layers: string[] = [];
  for (const sp of topLevelShapes(slideXml)) {
    if (/<a:t>[^<]*\S[^<]*<\/a:t>/.test(sp)) continue;
    const off = /<a:off x="(-?\d+)" y="(-?\d+)"\/>/.exec(sp);
    const ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(sp);
    if (!off || !ext) continue;
    const [x, y, w, h] = [+off[1], +off[2], +ext[1], +ext[2]];
    const covers = x <= slideW * 0.02 && y <= slideH * 0.02 && x + w >= slideW * 0.98 && y + h >= slideH * 0.98;
    if (!covers) continue;
    const spPr = /<p:spPr>([\s\S]*?)<\/p:spPr>/.exec(sp)?.[1] ?? "";
    const layer = fillLayer(spPr.replace(/<a:ln\b[\s\S]*?<\/a:ln>/g, ""));
    if (layer) layers.unshift(layer); // CSS lists the top layer first
  }
  const bg = /<p:bg>([\s\S]*?)<\/p:bg>/.exec(slideXml)?.[1];
  const bgGrad = bg && /<a:gradFill\b[\s\S]*?<\/a:gradFill>/.exec(bg)?.[0];
  const bgLayer = bgGrad ? gradientCss(bgGrad) : undefined;
  if (bgLayer) layers.push(bgLayer);
  if (!layers.length) return undefined;
  const solid = bg && !bgGrad ? /<a:solidFill>([\s\S]*?)<\/a:solidFill>/.exec(bg)?.[1] : undefined;
  return { image: layers.join(", "), color: solid ? cssColor(solid) : undefined };
}

/**
 * Backdrop CSS for the given slides of a .pptx (0-based, in presentation order). Slides with no
 * readable background art are left out.
 */
export async function pptxBackdropCss(pptx: ArrayBuffer | Uint8Array, slideIndexes: number[]): Promise<Map<number, BackdropCss>> {
  const zip = await JSZip.loadAsync(pptx);
  const pres = (await zip.file("ppt/presentation.xml")?.async("string")) ?? "";
  const rels = (await zip.file("ppt/_rels/presentation.xml.rels")?.async("string")) ?? "";
  const sz = /<p:sldSz\b[^>]*>/.exec(pres)?.[0] ?? "";
  const slideW = parseInt(attr(sz, "cx") ?? "0", 10);
  const slideH = parseInt(attr(sz, "cy") ?? "0", 10);
  const targets = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => [attr(m[0], "Id"), attr(m[0], "Target")]));
  const order = [...pres.matchAll(/<p:sldId\b[^>]*>/g)].map(m => targets.get(attr(m[0], "r:id")));

  const out = new Map<number, BackdropCss>();
  if (!slideW || !slideH) return out;
  for (const i of new Set(slideIndexes)) {
    const target = order[i];
    if (!target) continue;
    const xml = await zip.file(`ppt/${target.replace(/^\/?(ppt\/)?/, "")}`)?.async("string");
    const css = xml ? slideBackdropCss(xml, slideW, slideH) : undefined;
    if (css) out.set(i, css);
  }
  return out;
}
