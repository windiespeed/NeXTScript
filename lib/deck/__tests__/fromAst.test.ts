import { describe, expect, it } from "vitest";
import { astToDeck } from "@/lib/deck/fromAst";
import { layoutDeck } from "@/lib/deck/layout/registry";
import type { PresentationAST } from "@/types/slideAst";

const ast: PresentationAST = {
  lessonTitle: "Loops",
  targetAudience: "Beginners",
  slides: [
    { id: "a", type: "standard", title: "Lesson Overview", anchorId: "overview", paragraphs: ["Why we repeat code."], bulletPoints: ["for", "while", "do-while", "for...of", "forEach", "recursion", "map"] },
    { id: "b", type: "split-column", title: "for vs while", leftColumn: { heading: "for", content: ["Known count"] }, rightColumn: { heading: "while", content: ["Unknown count"] } },
    { id: "c", type: "code-explainer", title: "Count", language: "javascript", codeSnippet: "for (let i = 1; i <= 5; i++) {\n  console.log(i);\n}\n", explanationPoints: ["Start", "Condition", "Update"] },
    { id: "d", type: "callout", title: "Watch out", variant: "warning", content: "Infinite loops freeze the tab." },
    { id: "e", type: "step-grid", title: "How it runs", steps: [{ stepNumber: 2, title: "Check", description: "Test the condition" }, { stepNumber: 1, title: "Start", description: "Set i" }] },
    { id: "f", type: "standard", title: "Best Practices", paragraphs: [] },
  ],
};

describe("astToDeck", () => {
  const deck = astToDeck(ast);

  it("opens with a title slide and keeps every section heading in order", () => {
    expect(deck.slides[0]).toMatchObject({ type: "title", title: "Loops" });
    expect(deck.slides.map(s => ("title" in s ? s.title : s.type === "callout" ? s.heading : ""))).toEqual([
      "Loops", "Lesson Overview", "Lesson Overview (cont.)", "for vs while", "Count", "Watch out", "How it runs", "Best Practices",
    ]);
  });

  it("maps each slide type onto a deck type, splitting long lists", () => {
    expect(deck.slides.map(s => s.type)).toEqual(["title", "concept", "concept", "compare", "code", "callout", "steps", "callout"]);
    expect(deck.slides[1]).toMatchObject({ lead: "Why we repeat code.", bullets: ["for", "while", "do-while", "for...of", "forEach"] });
    expect(deck.slides[2]).toMatchObject({ bullets: ["recursion", "map"] });
    expect(deck.slides[4]).toMatchObject({ lines: ["for (let i = 1; i <= 5; i++) {", "  console.log(i);", "}"], pointOut: ["Start", "Condition", "Update"] });
    expect(deck.slides[6]).toMatchObject({ steps: [{ title: "Start" }, { title: "Check" }] });
  });

  it("lays out without errors", () => {
    expect(layoutDeck(deck).unsupported).toEqual([]);
  });
});
