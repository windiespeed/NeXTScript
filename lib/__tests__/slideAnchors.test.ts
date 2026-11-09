import { describe, expect, it } from "vitest";
import { applySlideAnchors, resolveSlideAnchors, wouldBreakAnchorOrder, PLACEHOLDER_TEXT, type SlideAnchor } from "@/lib/slideAnchors";
import type { PresentationAST, SlideNode } from "@/types/slideAst";

const anchors: SlideAnchor[] = [
  { id: "lessonOverview", label: "Lesson Overview" },
  { id: "vocabulary", label: "Vocabulary" },
  { id: "guidedLab", label: "Guided Activity" },
];

function std(id: string, title: string, extra: Partial<SlideNode> = {}): SlideNode {
  return { id, type: "standard", title, paragraphs: ["x"], ...extra } as SlideNode;
}

function deck(slides: SlideNode[]): PresentationAST {
  return { lessonTitle: "L", targetAudience: "A", slides };
}

const titles = (ast: PresentationAST) => ast.slides.map(s => s.title);

describe("applySlideAnchors", () => {
  it("leaves a conforming deck unchanged", () => {
    const input = deck([
      std("t", "Intro"),
      std("a", "Lesson Overview", { anchorId: "lessonOverview" }),
      std("b", "Vocabulary", { anchorId: "vocabulary" }),
      std("b2", "More terms"),
      std("c", "Guided Activity", { anchorId: "guidedLab" }),
    ]);
    const { ast, report } = applySlideAnchors(input, anchors);
    expect(ast.slides).toEqual(input.slides);
    expect(report).toEqual({ placeholders: [], retitled: [], reordered: false });
  });

  it("matches by heading, locks the exact label, and keeps the model's detail as subtitle", () => {
    const { ast, report } = applySlideAnchors(deck([
      std("a", "lesson overview"),
      std("b", "Vocabulary: Key Terms"),
      std("c", "Guided Activity"),
    ]), anchors);
    expect(titles(ast)).toEqual(["Lesson Overview", "Vocabulary", "Guided Activity"]);
    expect(ast.slides[1].subtitle).toBe("Key Terms");
    expect(ast.slides.map(s => s.anchorId)).toEqual(["lessonOverview", "vocabulary", "guidedLab"]);
    expect(report.retitled).toEqual(["Lesson Overview", "Vocabulary"]);
  });

  it("restores course order and carries supporting slides with their anchor", () => {
    const { ast, report } = applySlideAnchors(deck([
      std("c", "Guided Activity", { anchorId: "guidedLab" }),
      std("c2", "Lab step details"),
      std("a", "Lesson Overview", { anchorId: "lessonOverview" }),
      std("b", "Vocabulary", { anchorId: "vocabulary" }),
    ]), anchors);
    expect(titles(ast)).toEqual(["Lesson Overview", "Vocabulary", "Guided Activity", "Lab step details"]);
    expect(report.reordered).toBe(true);
  });

  it("inserts a placeholder for a skipped anchor", () => {
    const { ast, report } = applySlideAnchors(deck([
      std("a", "Lesson Overview", { anchorId: "lessonOverview" }),
      std("c", "Guided Activity", { anchorId: "guidedLab" }),
    ]), anchors);
    expect(titles(ast)).toEqual(["Lesson Overview", "Vocabulary", "Guided Activity"]);
    expect(ast.slides[1]).toMatchObject({ type: "standard", anchorId: "vocabulary", paragraphs: [PLACEHOLDER_TEXT] });
    expect(report.placeholders).toEqual(["Vocabulary"]);
  });

  it("drops unknown or duplicate anchorIds", () => {
    const { ast } = applySlideAnchors(deck([
      std("a", "Lesson Overview", { anchorId: "lessonOverview" }),
      std("a2", "Overview, again", { anchorId: "lessonOverview" }),
      std("z", "Stray", { anchorId: "nope" }),
      std("b", "Vocabulary"),
      std("c", "Guided Activity"),
    ]), anchors);
    expect(ast.slides.filter(s => s.anchorId).map(s => s.id)).toEqual(["a", "b", "c"]);
    expect(ast.slides.find(s => s.id === "z")?.anchorId).toBeUndefined();
  });

  it("is idempotent", () => {
    const once = applySlideAnchors(deck([std("c", "Guided Activity"), std("x", "Extra")]), anchors).ast;
    const twice = applySlideAnchors(once, anchors);
    expect(twice.ast.slides).toEqual(once.slides);
    expect(twice.report).toEqual({ placeholders: [], retitled: [], reordered: false });
  });

  it("strips anchors when the course has none", () => {
    const { ast } = applySlideAnchors(deck([std("a", "A", { anchorId: "lessonOverview" })]), []);
    expect(ast.slides[0].anchorId).toBeUndefined();
  });
});

describe("resolveSlideAnchors", () => {
  it("uses course sections in order and skips blank or duplicate labels", () => {
    const result = resolveSlideAnchors({
      settings: {
        sections: [
          { id: "s_1", label: "Warm-Up", includeInOverviewDoc: false },
          { id: "s_2", label: "  ", includeInOverviewDoc: false },
          { id: "s_3", label: "warm up", includeInOverviewDoc: false },
          { id: "s_4", label: "Lab", includeInOverviewDoc: false },
        ],
      },
    });
    expect(result).toEqual([{ id: "s_1", label: "Warm-Up" }, { id: "s_4", label: "Lab" }]);
  });

  it("falls back to the built-in sections when the course has none", () => {
    expect(resolveSlideAnchors(null).length).toBeGreaterThan(0);
  });
});

describe("wouldBreakAnchorOrder", () => {
  it("only blocks swapping two anchors", () => {
    const slides = [std("a", "A", { anchorId: "x" }), std("b", "B", { anchorId: "y" }), std("c", "C")];
    expect(wouldBreakAnchorOrder(slides, 0, 1)).toBe(true);
    expect(wouldBreakAnchorOrder(slides, 1, 2)).toBe(false);
  });
});
