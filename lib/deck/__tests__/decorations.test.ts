import { describe, expect, it } from "vitest";
import { layoutSlide } from "@/lib/deck/layout/registry";
import { SAMPLE_DECK } from "@/lib/deck/sample";
import { CANVAS_H } from "@/lib/deck/layout/types";

const concept = SAMPLE_DECK.slides.find(s => s.type === "concept")!;

describe("slide labels and footers", () => {
  it("puts the label where the accent bar was, so the title doesn't move", () => {
    const plain = layoutSlide(concept);
    const labeled = layoutSlide({ ...concept, label: "Part 1 · Loops" });
    const title = (l: typeof plain) => l.elements.find(e => e.id === "title")!;
    expect(title(labeled).y).toBe(title(plain).y);
    expect(labeled.elements.some(e => e.id === "accent")).toBe(false);
    const label = labeled.elements.find(e => e.id === "label")!;
    expect(label).toMatchObject({ kind: "text", uppercase: true, color: "accent.primary" });
    expect(label.y + label.h).toBeLessThanOrEqual(title(labeled).y);
  });

  it("adds the footer in the bottom margin, below everything else", () => {
    const l = layoutSlide({ ...concept, footer: "Part 1 · Repeating code" });
    const footer = l.elements.find(e => e.id === "footer")!;
    const others = l.elements.filter(e => e.id !== "footer");
    expect(footer.y).toBeGreaterThanOrEqual(Math.max(...others.map(e => e.y + e.h)));
    expect(footer.y + footer.h).toBeLessThanOrEqual(CANVAS_H);
  });

  it("adds nothing when the generator wrote neither", () => {
    expect(layoutSlide(concept).elements.some(e => e.id === "label" || e.id === "footer")).toBe(false);
  });
});
