import { describe, expect, it } from "vitest";
import { SAMPLE_DECK } from "@/lib/deck/sample";
import { layoutPlain, plainSlide } from "@/lib/deck/plain";
import { buildPlainSlides, placeholdersOf, plainText } from "@/lib/deck/render/googleSlides";
import { layoutOptionsForTheme, layoutSlide } from "@/lib/deck/layout/registry";
import { getTheme } from "@/lib/themes";
import type { DeckContent } from "@/lib/deck/schema";

describe("Plain (no theme)", () => {
  it("is a built-in look that asks for plain layouts", () => {
    const theme = getTheme("plain");
    expect(theme.name).toBe("Plain (no theme)");
    expect(layoutOptionsForTheme(theme)).toEqual({ plain: true });
    const s = SAMPLE_DECK.slides[2];
    expect(layoutSlide(s, { plain: true })).toEqual(layoutPlain(s));
  });

  it("reduces every slide type to a title and lines, keeping all the text", () => {
    for (const s of SAMPLE_DECK.slides) {
      const p = plainSlide(s);
      expect(p.title.length, s.type).toBeGreaterThan(0);
      if (p.kind === "content" && s.type !== "callout") expect(p.lines.length, s.type).toBeGreaterThan(0);
    }
    const compare = { id: "c", type: "compare", title: "SQL vs NoSQL", notes: "", left: { heading: "SQL", points: ["Tables"] }, right: { heading: "NoSQL", points: ["Documents"] } } as const;
    expect(plainSlide(compare as never).lines).toEqual([
      { text: "SQL", level: 0 },
      { text: "Tables", level: 1 },
      { text: "NoSQL", level: 0 },
      { text: "Documents", level: 1 },
    ]);
  });

  it("creates slides on Google's own layouts with no colors, fonts or backgrounds", () => {
    const { requests, slideIds } = buildPlainSlides(SAMPLE_DECK);
    expect(slideIds).toHaveLength(SAMPLE_DECK.slides.length);
    expect(requests.every(r => r.createSlide?.slideLayoutReference?.predefinedLayout)).toBe(true);
    expect(requests[0].createSlide!.slideLayoutReference!.predefinedLayout).toBe("TITLE");
    const json = JSON.stringify(requests);
    expect(json).not.toMatch(/rgbColor|themeColor|pageBackgroundFill|fontFamily/);
  });

  it("fills placeholders, nests bullets with tabs, and keeps code bullet-free in a monospace font", () => {
    const deck = {
      lessonTitle: "x",
      slides: [
        { id: "a", type: "compare", title: "Compare", notes: "", left: { heading: "L", points: ["l1"] }, right: { heading: "R", points: ["r1"] } },
        { id: "b", type: "code", title: "Code", notes: "", language: "js", lines: ["let x = 1;"], pointOut: ["x is 1"] },
      ],
    } as unknown as DeckContent;
    const reqs = plainText(deck, [{ title: "t0", body: "b0" }, { title: "t1", body: "b1" }]);
    const inserted = reqs.filter(r => r.insertText).map(r => [r.insertText!.objectId, r.insertText!.text]);
    expect(inserted).toEqual([["t0", "Compare"], ["b0", "L\n\tl1\nR\n\tr1"], ["t1", "Code"], ["b1", "let x = 1;\nx is 1"]]);
    const mono = reqs.find(r => r.updateTextStyle?.objectId === "b1")!.updateTextStyle!;
    expect(mono.style!.fontFamily).toBe("Roboto Mono");
    expect(mono.textRange).toEqual({ type: "FIXED_RANGE", startIndex: 0, endIndex: 10 });
    expect(reqs.some(r => r.deleteParagraphBullets?.objectId === "b1")).toBe(true);
    // Bullets go last range first, so a removed tab can't shift a later range.
    const b0 = reqs.filter(r => r.createParagraphBullets?.objectId === "b0").map(r => r.createParagraphBullets!.textRange!.startIndex);
    expect(b0).toEqual([...b0].sort((x, y) => y! - x!));
  });

  it("finds a layout's placeholders by type, and puts the title in the body when there is no title box", () => {
    expect(placeholdersOf({ pageElements: [{ objectId: "x", shape: { placeholder: { type: "CENTERED_TITLE" } } }, { objectId: "y", shape: { placeholder: { type: "SUBTITLE" } } }] })).toEqual({ title: "x", body: "y" });
    const deck = { lessonTitle: "x", slides: [{ id: "s", type: "section", title: "Part 2", notes: "" }] } as unknown as DeckContent;
    expect(plainText(deck, [{ body: "b" }]).find(r => r.insertText)!.insertText!.text).toBe("Part 2");
  });
});
