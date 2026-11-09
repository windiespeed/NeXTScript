import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CANVAS_H,
  CANVAS_W,
  DECK_SLIDE_TYPES,
  DeckSchema,
  LIMITS,
  SlideSchema,
  UnsupportedSlideTypeError,
  estHeight,
  fitCodeFont,
  layoutConcept,
  layoutDeck,
  layoutSlide,
  wrapLines,
} from "@/lib/deck";
import type { ConceptSlide, DeckSlide, SlideLayout } from "@/lib/deck";

const notes = "Ask the room where they've seen this before. Give 30 seconds to think.";

const concept = (over: Partial<ConceptSlide> = {}): ConceptSlide => ({
  id: "s1",
  type: "concept",
  title: "What a component is",
  notes,
  bullets: ["A function that returns UI", "Takes props as input", "Can hold its own state"],
  ...over,
});

const words = (n: number) => Array.from({ length: n }, (_, i) => (i % 3 === 0 ? "component" : "props")).join(" ");
const sized = (len: number) => words(60).slice(0, len).trim().padEnd(len, "x");

function inCanvas(layout: SlideLayout) {
  for (const el of layout.elements) {
    expect(el.x, el.id).toBeGreaterThanOrEqual(0);
    expect(el.y, el.id).toBeGreaterThanOrEqual(0);
    expect(el.x + el.w, el.id).toBeLessThanOrEqual(CANVAS_W);
    expect(el.y + el.h, el.id).toBeLessThanOrEqual(CANVAS_H);
  }
}

describe("DeckSchema", () => {
  it("covers 14 slide types", () => {
    expect(DECK_SLIDE_TYPES).toHaveLength(14);
  });

  it("accepts a valid concept slide", () => {
    expect(SlideSchema.safeParse(concept()).success).toBe(true);
  });

  it("requires speaker notes on every slide type", () => {
    for (const opt of SlideSchema.options) {
      expect(opt.shape.notes, opt.shape.type.value).toBeDefined();
      expect(opt.shape.notes.safeParse(undefined).success).toBe(false);
    }
    expect(SlideSchema.safeParse({ ...concept(), notes: undefined }).success).toBe(false);
  });

  it("enforces concept bullet count and length limits", () => {
    const six = Array.from({ length: LIMITS.concept.bullets + 1 }, () => "x");
    expect(SlideSchema.safeParse(concept({ bullets: six })).success).toBe(false);
    expect(SlideSchema.safeParse(concept({ bullets: ["x".repeat(LIMITS.concept.bullet + 1)] })).success).toBe(false);
    expect(SlideSchema.safeParse(concept({ bullets: ["x".repeat(LIMITS.concept.bullet)] })).success).toBe(true);
  });

  it("tightens concept bullets when there is an aside", () => {
    const aside = { label: "Analogy", body: "Like a LEGO brick." };
    const five = Array.from({ length: 5 }, () => "x");
    expect(SlideSchema.safeParse(concept({ bullets: five })).success).toBe(true);
    expect(SlideSchema.safeParse(concept({ bullets: five, aside })).success).toBe(false);
    expect(SlideSchema.safeParse(concept({ bullets: ["x".repeat(101)], aside })).success).toBe(false);
    expect(SlideSchema.safeParse(concept({ bullets: ["x".repeat(100)], aside })).success).toBe(true);
  });

  it("enforces code line count and width", () => {
    const code = {
      id: "c", type: "code", title: "Hello", notes, language: "js",
      lines: ["const a = 1;"], pointOut: ["`const` can't be reassigned"],
    };
    expect(SlideSchema.safeParse(code).success).toBe(true);
    expect(SlideSchema.safeParse({ ...code, lines: Array(LIMITS.code.lines + 1).fill("x") }).success).toBe(false);
    expect(SlideSchema.safeParse({ ...code, lines: ["x".repeat(LIMITS.code.lineChars + 1)] }).success).toBe(false);
  });

  it("rejects unknown slide types", () => {
    expect(SlideSchema.safeParse({ ...concept(), type: "standard" }).success).toBe(false);
  });

  it("converts to JSON Schema for structured outputs", () => {
    const json = z.toJSONSchema(DeckSchema) as Record<string, unknown>;
    expect(json.type).toBe("object");
    expect(JSON.stringify(json)).toContain('"maxItems":5');
  });
});

describe("fit helpers", () => {
  it("wraps by words", () => {
    expect(wrapLines("aaa bbb ccc", 7)).toBe(2);
    expect(wrapLines("aaa bbb ccc", 11)).toBe(1);
    expect(wrapLines("x".repeat(25), 10)).toBe(3);
  });

  it("estimates more height for narrower boxes", () => {
    const p = [{ text: words(40) }];
    const o = { fontSize: 16, font: "body" as const, lineHeight: 1.3, paragraphGap: 0 };
    expect(estHeight(p, { ...o, width: 300 })).toBeGreaterThan(estHeight(p, { ...o, width: 600 }));
  });

  it("flags code lines too wide for the panel", () => {
    const r = fitCodeFont(["x".repeat(68)], { width: 300, height: 300, lineHeight: 1.4 });
    expect(r.severity).toBe("overflow");
    expect(fitCodeFont(["const a = 1;"], { width: 300, height: 300, lineHeight: 1.4 }).severity).toBeUndefined();
  });
});

describe("concept layout", () => {
  it("lays out a short slide at full size with no warnings", () => {
    const l = layoutConcept(concept());
    expect(l.warnings).toEqual([]);
    expect(l.notes).toBe(notes);
    const body = l.elements.find(e => e.id === "body");
    expect(body).toMatchObject({ kind: "text", w: CANVAS_W - 80, fontSize: 18 });
    expect(l.elements.some(e => e.id.startsWith("aside"))).toBe(false);
    inCanvas(l);
  });

  it("narrows the body and adds a panel when there is an aside", () => {
    const l = layoutConcept(concept({ lead: "Everything on screen is a component.", aside: { label: "Analogy", body: "Like a LEGO brick: small, reusable, and it snaps into bigger things." } }));
    const body = l.elements.find(e => e.id === "body")!;
    const panel = l.elements.find(e => e.id === "aside.panel")!;
    expect(body.w).toBeLessThan(CANVAS_W - 80);
    expect(panel.x).toBeGreaterThanOrEqual(body.x + body.w);
    expect(l.elements.map(e => e.id)).toEqual(["accent", "title", "lead", "body", "aside.panel", "aside.stripe", "aside.label", "aside.body"]);
    inCanvas(l);
  });

  it("stacks title, lead, and body without overlap", () => {
    const l = layoutConcept(concept({ lead: "A lead line." }));
    const [title, lead, body] = ["title", "lead", "body"].map(id => l.elements.find(e => e.id === id)!);
    expect(lead.y).toBeGreaterThanOrEqual(title.y + title.h);
    expect(body.y).toBeGreaterThanOrEqual(lead.y + lead.h);
  });

  it.each([false, true])("fits max-length content without overflow (aside: %s)", withAside => {
    const lim = withAside ? LIMITS.concept.withAside : LIMITS.concept;
    const max = concept({
      title: sized(LIMITS.slideTitle),
      lead: sized(LIMITS.concept.lead),
      bullets: Array.from({ length: lim.bullets }, () => sized(lim.bullet)),
      aside: withAside ? { label: sized(LIMITS.concept.asideLabel), body: sized(LIMITS.concept.asideBody) } : undefined,
    });
    expect(SlideSchema.safeParse(max).success).toBe(true);
    const l = layoutConcept(max);
    inCanvas(l);
    expect(l.warnings.filter(w => w.severity === "overflow")).toEqual([]);
    // Worst case is allowed to shrink, but it must say so.
    const body = l.elements.find(e => e.id === "body");
    if (body?.kind === "text" && body.fontSize < 15) {
      expect(l.warnings).toContainEqual(expect.objectContaining({ elementId: "body", severity: "shrunk" }));
    }
  });

  it("reports overflow when content exceeds what the box can hold", () => {
    // Bypasses the schema on purpose: simulates a layout change that shrinks the box.
    const l = layoutConcept(concept({ bullets: Array.from({ length: 12 }, () => sized(130)) }));
    expect(l.warnings).toContainEqual(expect.objectContaining({ elementId: "body", severity: "overflow" }));
  });
});

describe("registry", () => {
  it("routes concept slides and refuses types without a layout yet", () => {
    expect(layoutSlide(concept()).slideId).toBe("s1");
    const title: DeckSlide = { id: "t", type: "title", title: "Day 1", notes };
    expect(() => layoutSlide(title)).toThrow(UnsupportedSlideTypeError);
    const { slides, unsupported } = layoutDeck({ lessonTitle: "Components", slides: [title, concept()] });
    expect(slides).toHaveLength(1);
    expect(unsupported.map(s => s.type)).toEqual(["title"]);
  });
});
