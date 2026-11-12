import { describe, expect, it } from "vitest";
import {
  CURRICULUM_ARCHITECT_SYSTEM_PROMPT,
  PRESENTATION_AST_JSON_SCHEMA,
  anchorOutline,
  assertValidAst,
  buildOutlinePrompt,
  buildUserPrompt,
  moveInstructorNotes,
  toOutline,
} from "@/lib/ingestionPrompt";
import type { PresentationAST } from "@/types/slideAst";

const anchors = [
  { id: "lessonOverview", label: "Lesson Overview" },
  { id: "guidedLab", label: "Guided Activity" },
];

describe("Notes to Slides prompt", () => {
  it("asks for headlines, labels, notes, takeaways and the new layouts", () => {
    for (const phrase of ["label", "headline", "notes", "takeaway", "card-row", "table", "output", "at most about 60 words"]) {
      expect(CURRICULUM_ARCHITECT_SYSTEM_PROMPT).toContain(phrase);
    }
    expect(CURRICULUM_ARCHITECT_SYSTEM_PROMPT).toContain('Never put "Instructor Note"');
  });

  it("lists anchors as labels and includes an approved outline", () => {
    const prompt = buildUserPrompt("notes", {
      anchors,
      outline: [{ title: "Why it matters", label: "Lesson Overview", anchorId: "lessonOverview", type: "card-row", summary: "Three everyday examples" }],
    });
    expect(prompt).toContain('label: "Lesson Overview"  anchorId: "lessonOverview"');
    expect(prompt).toContain("APPROVED OUTLINE");
    expect(prompt).toContain('title: "Why it matters"');
    expect(prompt).toContain("layout: card-row");
    expect(prompt).toContain("covers: Three everyday examples");
  });

  it("builds the outline prompt from the same context, asking for an outline instead", () => {
    const prompt = buildOutlinePrompt("my notes", { anchors, lessonTitle: "Meet JavaScript" });
    expect(prompt).toContain("Plan an outline");
    expect(prompt).toContain("my notes");
    expect(prompt).toContain("Lesson Title: Meet JavaScript");
    expect(prompt).not.toContain("PresentationAST");
  });

  it("gives Gemini a schema with every layout and the shared fields", () => {
    const variants = PRESENTATION_AST_JSON_SCHEMA.properties.slides.items.anyOf;
    expect(variants.map(v => (v.properties.type as { const: string }).const).sort()).toEqual(
      ["callout", "card-row", "code-explainer", "split-column", "standard", "step-grid", "table"],
    );
    for (const v of variants) expect(Object.keys(v.properties)).toEqual(expect.arrayContaining(["label", "notes", "takeaway"]));
  });

  it("accepts the new slide types", () => {
    expect(() => assertValidAst({ lessonTitle: "L", targetAudience: "A", slides: [{ id: "1", type: "table", title: "T", columns: ["a", "b"], rows: [["1", "2"]] }] })).not.toThrow();
    expect(() => assertValidAst({ lessonTitle: "L", targetAudience: "A", slides: [{ id: "1", type: "card-row", title: "T", cards: [] }] })).not.toThrow();
  });
});

describe("moveInstructorNotes", () => {
  it("moves instructor lines off the slide into the notes", () => {
    const ast: PresentationAST = {
      lessonTitle: "L", targetAudience: "A",
      slides: [
        { id: "1", type: "standard", title: "T", paragraphs: ["Intro."], bulletPoints: ["Point", "Instructor Note: Ask a question."], notes: "Start warm." },
        { id: "2", type: "split-column", title: "S", leftColumn: { heading: "A", content: ["a", "Teacher tip - pause here"] }, rightColumn: { heading: "B", content: ["b"] } },
        { id: "3", type: "standard", title: "U", paragraphs: ["The instructor note system is useful."] },
      ],
    };
    const out = moveInstructorNotes(ast);
    expect(out.slides[0]).toMatchObject({ bulletPoints: ["Point"], notes: "Start warm.\n\nAsk a question." });
    expect(out.slides[1]).toMatchObject({ leftColumn: { content: ["a"] }, notes: "pause here" });
    // Only a leading "Instructor Note:" counts.
    expect(out.slides[2]).toBe(ast.slides[2]);
  });
});

describe("outlines", () => {
  it("tidies a parsed outline and drops untitled or unknown entries", () => {
    const o = toOutline({ lessonTitle: "Meet JS", slides: [{ title: "One", type: "card-row" }, { title: "" }, { title: "Two", type: "nope", summary: "x" }] });
    expect(o.slides).toEqual([{ title: "One", type: "card-row" }, { title: "Two", summary: "x" }]);
    expect(() => toOutline({ slides: [] })).toThrow();
  });

  it("locks course sections into the outline, in order, adding any it missed", () => {
    const o = anchorOutline({
      lessonTitle: "L",
      slides: [
        { title: "Your first line", anchorId: "guidedLab", type: "code-explainer" },
        { title: "Why it matters", label: "lesson overview", type: "card-row", summary: "Everyday examples" },
        { title: "Extra practice" },
      ],
    }, [...anchors, { id: "vocabulary", label: "Vocabulary" }]);
    expect(o.slides).toEqual([
      { title: "Why it matters", label: "Lesson Overview", anchorId: "lessonOverview", type: "card-row", summary: "Everyday examples" },
      // A supporting slide stays with the section it followed.
      { title: "Extra practice", label: "Lesson Overview" },
      { title: "Your first line", label: "Guided Activity", anchorId: "guidedLab", type: "code-explainer" },
      { title: "Vocabulary", label: "Vocabulary", anchorId: "vocabulary" },
    ]);
  });
});
