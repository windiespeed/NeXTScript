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
    // Seven points split evenly (4 + 3), not 5 + 2.
    expect(deck.slides[1]).toMatchObject({ lead: "Why we repeat code.", bullets: ["for", "while", "do-while", "for...of"] });
    expect(deck.slides[2]).toMatchObject({ bullets: ["forEach", "recursion", "map"] });
    expect(deck.slides[4]).toMatchObject({ lines: ["for (let i = 1; i <= 5; i++) {", "  console.log(i);", "}"], pointOut: ["Start", "Condition", "Update"] });
    expect(deck.slides[6]).toMatchObject({ steps: [{ title: "Start" }, { title: "Check" }] });
  });

  it("keeps six points on one slide rather than leaving one alone", () => {
    const six = astToDeck({ ...ast, slides: [{ id: "x", type: "standard", title: "Targets", paragraphs: [], bulletPoints: ["a", "b", "c", "d", "e", "f"] }] });
    expect(six.slides).toHaveLength(2);
  });

  it("lays out without errors", () => {
    expect(layoutDeck(deck).unsupported).toEqual([]);
  });
});

describe("astToDeck: labels, notes, takeaways and the new layouts", () => {
  const rich: PresentationAST = {
    lessonTitle: "Meet JavaScript",
    lessonSubtitle: "A friendly first look",
    targetAudience: "Beginners",
    slides: [
      { id: "a", type: "standard", label: "Lesson Overview", anchorId: "overview", title: "JavaScript makes pages respond", paragraphs: ["Pages that react to you."], bulletPoints: ["Clicks", "Forms"], notes: "Ask who has clicked a like button today.", takeaway: "JavaScript adds behavior." },
      { id: "b", type: "card-row", label: "Lesson Overview", title: "Three languages, three jobs", cards: [{ tag: "Structure", heading: "HTML", body: "The skeleton." }, { tag: "Style", heading: "CSS", body: "The look." }, { tag: "Action", heading: "JavaScript", body: "The behavior." }] },
      { id: "c", type: "table", title: "Props vs. state", columns: ["", "Props", "State"], rows: [["Comes from", "Parent", "Itself"], ["Changes?", "No", "Yes"]] },
      { id: "d", type: "code-explainer", title: "Say hello", language: "javascript", codeSnippet: "console.log(\"Hello!\");", output: "Hello!", explanationPoints: ["console.log prints a message"] },
    ],
  };
  const deck = astToDeck(rich);

  it("makes a cover with the tagline and footers with the lesson title", () => {
    expect(deck.slides[0]).toMatchObject({ type: "title", title: "Meet JavaScript", subtitle: "A friendly first look" });
    expect(deck.slides.slice(1).every(s => s.footer === "Meet JavaScript")).toBe(true);
  });

  it("carries the section label, notes and takeaway", () => {
    expect(deck.slides[1]).toMatchObject({ label: "Lesson Overview", title: "JavaScript makes pages respond", notes: "Ask who has clicked a like button today.", takeaway: "JavaScript adds behavior." });
    expect(deck.slides[3].label).toBeUndefined();
  });

  it("maps card rows, tables and code output", () => {
    expect(deck.slides[2]).toMatchObject({ type: "cards", cards: [{ tag: "Structure", heading: "HTML" }, { tag: "Style" }, { tag: "Action" }] });
    expect(deck.slides[3]).toMatchObject({ type: "table", columns: ["", "Props", "State"], rows: [["Comes from", "Parent", "Itself"], ["Changes?", "No", "Yes"]] });
    expect(deck.slides[4]).toMatchObject({ type: "code", output: ["Hello!"] });
  });

  it("lays every slide out without overflow", () => {
    const { slides } = layoutDeck(deck);
    expect(slides.flatMap(s => s.warnings).filter(w => w.severity === "overflow")).toEqual([]);
    const code = slides.find(s => s.slideId === "d")!;
    expect(code.elements.some(e => e.id === "output.panel")).toBe(true);
    const first = slides.find(s => s.slideId === "a")!;
    const takeaway = first.elements.find(e => e.id === "takeaway")!;
    const body = first.elements.find(e => e.id === "body")!;
    expect(body.y + body.h).toBeLessThanOrEqual(takeaway.y);
  });

  it("keeps long code with output on slides that fit", () => {
    const long = astToDeck({ ...rich, slides: [{ id: "x", type: "code-explainer", title: "Loop", language: "js", codeSnippet: Array.from({ length: 14 }, (_, i) => `step${i}();`).join("\n"), output: "1\n2", explanationPoints: ["Runs in order"] }] });
    const parts = long.slides.filter(s => s.type === "code");
    expect(parts.length).toBe(2);
    expect(parts[1]).toMatchObject({ output: ["1", "2"] });
    expect(layoutDeck(long).slides.flatMap(s => s.warnings).filter(w => w.severity === "overflow")).toEqual([]);
  });
});
