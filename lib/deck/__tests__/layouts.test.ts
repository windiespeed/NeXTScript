import { describe, expect, it } from "vitest";
import { CANVAS_H, CANVAS_W, DARK_SLIDE_TYPES, DECK_SLIDE_TYPES, SlideSchema, hasLayout, layoutSlide } from "@/lib/deck";
import type { DeckSlide, SlideLayout, TextElement } from "@/lib/deck";
import { MAX_SLIDES, MIN_SLIDES } from "./fixtures";

function inCanvas(layout: SlideLayout) {
  for (const el of layout.elements) {
    expect(el.x, el.id).toBeGreaterThanOrEqual(0);
    expect(el.y, el.id).toBeGreaterThanOrEqual(0);
    expect(el.x + el.w, el.id).toBeLessThanOrEqual(CANVAS_W + 0.01);
    expect(el.y + el.h, el.id).toBeLessThanOrEqual(CANVAS_H + 0.01);
    expect(el.w, el.id).toBeGreaterThan(0);
    expect(el.h, el.id).toBeGreaterThan(0);
  }
}

/** Text boxes must not overlap each other (rects behind text are fine). */
function noTextOverlap(layout: SlideLayout) {
  const texts = layout.elements.filter((e): e is TextElement => e.kind === "text");
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i];
      const b = texts[j];
      const overlap = a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
      expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
    }
  }
}

describe.each(DECK_SLIDE_TYPES)("%s layout", type => {
  const cases: [string, DeckSlide][] = [
    ["max", MAX_SLIDES[type]],
    ["min", MIN_SLIDES[type]],
  ];

  it("has a registered layout", () => {
    expect(hasLayout(type)).toBe(true);
  });

  it.each(cases)("%s-content fixture is valid", (_name, slide) => {
    const r = SlideSchema.safeParse(slide);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it.each(cases)("%s content stays on the canvas without overlapping text", (_name, slide) => {
    const layout = layoutSlide(slide);
    expect(layout.slideId).toBe(slide.id);
    expect(layout.notes).toBe(slide.notes);
    expect(layout.dark).toBe(DARK_SLIDE_TYPES.has(type));
    inCanvas(layout);
    noTextOverlap(layout);
  });

  it("fits content at the schema limits without overflow", () => {
    const layout = layoutSlide(MAX_SLIDES[type]);
    expect(layout.warnings.filter(w => w.severity === "overflow")).toEqual([]);
  });

  it("minimal content needs no shrinking", () => {
    expect(layoutSlide(MIN_SLIDES[type]).warnings).toEqual([]);
  });

  it("text element ids are unique", () => {
    const ids = layoutSlide(MAX_SLIDES[type]).elements.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
