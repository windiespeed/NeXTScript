import { describe, expect, it } from "vitest";
import { buildNotesFromLesson, parseClassicSlideBlocks, hasSeedableContent } from "@/lib/lessonSeed";
import { DEFAULT_SECTIONS } from "@/types/section";

describe("parseClassicSlideBlocks", () => {
  it("splits on blank lines and uses the first line as the title", () => {
    expect(parseClassicSlideBlocks("Flexbox\nOne axis\n\nGrid\nTwo axes")).toEqual([
      { title: "Flexbox", body: "One axis" },
      { title: "Grid", body: "Two axes" },
    ]);
  });

  it("prefers --- separators so blocks can contain blank lines", () => {
    expect(parseClassicSlideBlocks("A\nline 1\n\nline 2\n---\nB\nx")).toEqual([
      { title: "A", body: "line 1\n\nline 2" },
      { title: "B", body: "x" },
    ]);
  });

  it("returns nothing for empty content", () => {
    expect(parseClassicSlideBlocks("  \n ")).toEqual([]);
  });
});

describe("buildNotesFromLesson", () => {
  it("orders before-slides sections, slide blocks, then after-slides sections", () => {
    const notes = buildNotesFromLesson({
      slideContent: "Flexbox\nOne axis",
      sections: { learningTargets: "Use flex", guidedLab: "Build a navbar", rubric: "10 pts" },
    }, DEFAULT_SECTIONS);
    expect(notes).toBe("## Learning Targets\nUse flex\n\n## Flexbox\nOne axis\n\n## Guided Activity\nBuild a navbar");
  });

  it("skips doc-only sections such as the rubric", () => {
    const notes = buildNotesFromLesson({ sections: { rubric: "10 pts" } }, DEFAULT_SECTIONS);
    expect(notes).toBe("");
  });

  it("reads legacy fixed fields when the lesson has no sections map", () => {
    const lesson = { slideContent: "", vocabulary: "flex: a layout mode" } as { slideContent: string };
    expect(buildNotesFromLesson(lesson, DEFAULT_SECTIONS)).toContain("flex: a layout mode");
    expect(hasSeedableContent(lesson, DEFAULT_SECTIONS)).toBe(true);
    expect(hasSeedableContent({ slideContent: "" , sections: {} }, DEFAULT_SECTIONS)).toBe(false);
  });
});
