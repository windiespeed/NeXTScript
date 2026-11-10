/**
 * The dark, big-type slides: title, section divider, callout, and closing.
 * They have no standard header; text sits in a block left-aligned (title, section, closing)
 * or centered (callout) on a dark surface.
 */

import type { SlideOf } from "../schema";
import { GRID, SlideBuilder, bullets } from "./kit";
import type { ColorToken, SlideLayout } from "./types";
import { CANVAS_H, CANVAS_W } from "./types";

const STRIPE = { x: GRID.marginX, w: 6 };
const TEXT_X = GRID.marginX + 28;
const TEXT_W = CANVAS_W - TEXT_X - 80;

/** Title slide: kicker, big title, subtitle, with an accent stripe down the left of the block. */
export function layoutTitle(slide: SlideOf<"title">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes, true);
  const top = 110;
  let y = top;
  if (slide.kicker) {
    y += b.label("kicker", slide.kicker, TEXT_X, y, TEXT_W, "accent.primary", 13) + 12;
  }
  const title = b.text({
    id: "title", what: "Title",
    paragraphs: [{ text: slide.title }],
    x: TEXT_X, y, w: TEXT_W, h: 120,
    font: "heading", maxSize: 42, minSize: 30, warnBelow: 34, lineHeight: 1.1,
    color: "text.primary", hug: true,
  });
  y += title.h;
  if (slide.subtitle) {
    y += 14;
    const sub = b.text({
      id: "subtitle", what: "Subtitle",
      paragraphs: [{ text: slide.subtitle }],
      x: TEXT_X, y, w: TEXT_W, h: 60,
      maxSize: 18, minSize: 14, lineHeight: 1.3,
      color: "text.secondary", hug: true,
    });
    y += sub.h;
  }
  b.elements.unshift({ kind: "rect", id: "stripe", x: STRIPE.x, y: top, w: STRIPE.w, h: y - top, fill: "accent.primary", radius: 3 });
  return b.build();
}

/** Section divider: like the title slide, a little smaller, vertically centered. */
export function layoutSection(slide: SlideOf<"section">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes, true);
  const kickerH = slide.kicker ? 13 * 1.2 + 12 : 0;
  // Measure first to center the block vertically.
  const titleH = b.measure({ paragraphs: [{ text: slide.title }], w: TEXT_W, h: 110, font: "heading", maxSize: 36, minSize: 26, lineHeight: 1.1 });
  const subH = slide.subtitle ? b.measure({ paragraphs: [{ text: slide.subtitle }], w: TEXT_W, h: 60, maxSize: 17, minSize: 13 }) + 12 : 0;
  const blockH = kickerH + titleH + subH;
  const top = Math.max(GRID.top, Math.round((CANVAS_H - blockH) / 2));

  let y = top;
  if (slide.kicker) y += b.label("kicker", slide.kicker, TEXT_X, y, TEXT_W, "accent.primary", 13) + 12;
  const title = b.text({
    id: "title", what: "Title",
    paragraphs: [{ text: slide.title }],
    x: TEXT_X, y, w: TEXT_W, h: 110,
    font: "heading", maxSize: 36, minSize: 26, lineHeight: 1.1,
    color: "text.primary", hug: true,
  });
  y += title.h;
  if (slide.subtitle) {
    y += 12;
    const sub = b.text({
      id: "subtitle", what: "Subtitle",
      paragraphs: [{ text: slide.subtitle }],
      x: TEXT_X, y, w: TEXT_W, h: 60,
      maxSize: 17, minSize: 13, color: "text.secondary", hug: true,
    });
    y += sub.h;
  }
  b.elements.unshift({ kind: "rect", id: "stripe", x: STRIPE.x, y: top, w: STRIPE.w, h: y - top, fill: "accent.primary", radius: 3 });
  return b.build();
}

export const CALLOUT_STYLE: Record<SlideOf<"callout">["variant"], { label: string; accent: ColorToken }> = {
  "key-idea": { label: "Key idea", accent: "accent.primary" },
  tip: { label: "Tip", accent: "accent.tertiary" },
  warning: { label: "Heads up", accent: "accent.secondary" },
  "instructor-note": { label: "Instructor note", accent: "accent.tertiary" },
};

/** Callout: one centered statement, with a variant label and optional supporting line. */
export function layoutCallout(slide: SlideOf<"callout">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes, true);
  const style = CALLOUT_STYLE[slide.variant];
  const w = 560;
  const x = (CANVAS_W - w) / 2;

  const hH = b.measure({ paragraphs: [{ text: slide.heading }], w, h: 150, font: "heading", maxSize: 32, minSize: 22, lineHeight: 1.15 });
  const bH = slide.body ? b.measure({ paragraphs: [{ text: slide.body }], w, h: 110, maxSize: 18, minSize: 13 }) + 18 : 0;
  const labelBlock = 4 + 14 + 12 * 1.2 + 16;
  const top = Math.max(GRID.top, Math.round((CANVAS_H - (labelBlock + hH + bH)) / 2));

  let y = top;
  b.rect("accent", (CANVAS_W - 40) / 2, y, 40, 4, style.accent, 2);
  y += 4 + 14;
  b.elements.push({
    kind: "text", id: "label", x, y, w, h: Math.ceil(12 * 1.2),
    font: "body", fontSize: 12, lineHeight: 1.2, paragraphGap: 0,
    color: style.accent, align: "center", valign: "top", uppercase: true, letterSpacing: 1.5,
    paragraphs: [{ text: style.label, bold: true }],
  });
  y += Math.ceil(12 * 1.2) + 16;
  const heading = b.text({
    id: "heading", what: "Callout heading",
    paragraphs: [{ text: slide.heading }],
    x, y, w, h: 150,
    font: "heading", maxSize: 32, minSize: 22, lineHeight: 1.15,
    color: "text.primary", align: "center", hug: true,
  });
  y += heading.h;
  if (slide.body) {
    y += 18;
    b.text({
      id: "body", what: "Callout text",
      paragraphs: [{ text: slide.body }],
      x, y, w, h: Math.min(110, GRID.bodyBottom - y),
      maxSize: 18, minSize: 13, color: "text.secondary", align: "center", hug: true,
    });
  }
  return b.build();
}

/** Closing: big title, up to three takeaways, and a "Next up" line at the bottom. */
export function layoutClosing(slide: SlideOf<"closing">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes, true);
  const top = slide.takeaways?.length ? 70 : 130;
  let y = top;
  const title = b.text({
    id: "title", what: "Title",
    paragraphs: [{ text: slide.title }],
    x: TEXT_X, y, w: TEXT_W, h: 90,
    font: "heading", maxSize: 36, minSize: 26, warnBelow: 28, lineHeight: 1.1,
    color: "text.primary", hug: true,
  });
  y += title.h;
  b.elements.unshift({ kind: "rect", id: "stripe", x: STRIPE.x, y: top, w: STRIPE.w, h: title.h, fill: "accent.primary", radius: 3 });

  const nextUpH = slide.nextUp ? 60 : 0;
  if (slide.takeaways?.length) {
    y += 24;
    b.text({
      id: "takeaways", what: "Takeaways",
      paragraphs: bullets(slide.takeaways),
      x: TEXT_X, y, w: TEXT_W, h: GRID.bodyBottom - nextUpH - y,
      maxSize: 18, minSize: 13, warnBelow: 15, gapEm: 0.6, color: "text.secondary",
    });
  }
  if (slide.nextUp) {
    const ny = GRID.bodyBottom - nextUpH + 8;
    b.label("nextUp.label", "Next up", TEXT_X, ny, TEXT_W, "accent.primary", 10);
    b.text({
      id: "nextUp", what: "Next up",
      paragraphs: [{ text: slide.nextUp }],
      x: TEXT_X, y: ny + 16, w: TEXT_W, h: nextUpH - 24,
      maxSize: 15, minSize: 12, warnBelow: 12, color: "text.primary",
    });
  }
  return b.build();
}
