import { describe, expect, it } from "vitest";
import type { slides_v1 } from "googleapis";
import { learnTemplateStyle, luminance } from "@/lib/deck/render/templateStyle";
import { buildSlidesRequests, inspectTemplate, slidesFont } from "@/lib/deck/render/googleSlides";
import { SAMPLE_DECK } from "@/lib/deck/sample";
import { getTheme } from "@/lib/themes";

const hex = (h: string): slides_v1.Schema$OpaqueColor => {
  const n = parseInt(h.slice(1), 16);
  return { rgbColor: { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 } };
};
const bg = (h: string): slides_v1.Schema$PageProperties => ({ pageBackgroundFill: { solidFill: { color: hex(h) } } });
const text = (runs: [string, string, number, string, boolean?][]): slides_v1.Schema$PageElement => ({
  shape: {
    shapeType: "TEXT_BOX",
    text: { textElements: runs.map(([content, font, size, color, bold]) => ({ textRun: { content, style: { fontFamily: font, fontSize: { magnitude: size, unit: "PT" }, foregroundColor: { opaqueColor: hex(color) }, bold: !!bold } } })) },
  },
});
const card = (fill: string): slides_v1.Schema$PageElement => ({
  size: { width: { magnitude: 2000000, unit: "EMU" }, height: { magnitude: 1000000, unit: "EMU" } },
  shape: { shapeType: "ROUND_RECTANGLE", shapeProperties: { shapeBackgroundFill: { solidFill: { color: hex(fill) } } } },
});

// Shaped like a real course deck: Google-default master and one blank layout, with every slide
// styled directly (brown title and section slides, navy content slides, Calibri text).
const defaultMaster: slides_v1.Schema$Page = {
  objectId: "m",
  pageProperties: { colorScheme: { colors: [{ type: "DARK1", color: {} }, { type: "LIGHT1", color: { red: 1, green: 1, blue: 1 } }, { type: "ACCENT1", color: hex("#4472C4").rgbColor }] } },
};
const handStyled: slides_v1.Schema$Presentation = {
  pageSize: { width: { magnitude: 9144000, unit: "EMU" }, height: { magnitude: 5143500, unit: "EMU" } },
  masters: [defaultMaster],
  layouts: [{ objectId: "l", layoutProperties: { name: "DEFAULT", masterObjectId: "m" }, pageElements: [] }],
  slides: [
    { objectId: "s1", slideProperties: { layoutObjectId: "l", masterObjectId: "m" }, pageProperties: bg("#4D3522"), pageElements: [text([["7 PARTS", "Calibri", 9, "#F0A050", true]]), text([["Databases & Auth", "Calibri", 40, "#FFFFFF", true]]), text([["Data that survives.", "Carlito", 14, "#F3E9DC"]])] },
    ...[2, 3, 5].map(i => ({
      objectId: `s${i}`,
      slideProperties: { layoutObjectId: "l", masterObjectId: "m" },
      pageProperties: bg("#262E3E"),
      pageElements: [
        text([["PART 1 · SQL VS NOSQL", "Calibri", 8, "#F0A050", true]]),
        text([["Two ways to store data", "Calibri", 22, "#FFFFFF", true]]),
        card("#323C50"),
        text([["Relational (SQL)", "Calibri", 12, "#6FA8FF", true], ["Tables with fixed columns, like a strict spreadsheet.", "Carlito", 11, "#D7DCE5"]]),
        text([["const x = 1", "Courier New", 10, "#A6E22E"]]),
      ],
    })),
    { objectId: "s4", slideProperties: { layoutObjectId: "l", masterObjectId: "m" }, pageProperties: bg("#4D3522"), pageElements: [text([["PART 1", "Calibri", 9, "#F0A050", true]]), text([["From files to MongoDB", "Calibri", 32, "#FFFFFF", true]])] },
  ],
};

describe("learnTemplateStyle", () => {
  it("reads a hand-styled deck's backgrounds, fonts and colors from its slides", () => {
    const s = learnTemplateStyle(handStyled)!;
    expect(s.content.background).toBe("#262E3E");
    expect(s.cover.background).toBe("#4D3522");
    expect(s.content.title).toBe("#FFFFFF");
    expect(s.content.body).toBe("#D7DCE5");
    expect(s.content.panel).toBe("#323C50");
    expect([s.content.accent1, s.content.accent2]).toEqual(expect.arrayContaining(["#F0A050", "#6FA8FF"]));
    expect(s.cover.accent1).toBe("#F0A050");
    expect(s.headingFont).toBe("Calibri");
    expect(s.bodyFont).toBe("Carlito");
  });

  it("leaves templates whose slides set nothing to the master and layouts", () => {
    expect(learnTemplateStyle({ ...handStyled, slides: [{ objectId: "x", pageElements: [] }] })).toBeUndefined();
    expect(learnTemplateStyle({ ...handStyled, slides: [] })).toBeUndefined();
  });

  it("keeps text readable when a slide's colors can't be read", () => {
    const s = learnTemplateStyle({ ...handStyled, slides: [{ objectId: "x", pageProperties: bg("#101820"), pageElements: [] }] })!;
    expect(luminance(s.content.title)).toBeGreaterThan(0.9);
  });
});

describe("Google Slides export with a learned style", () => {
  const template = inspectTemplate(handStyled);
  const learned = learnTemplateStyle(handStyled)!;
  const { requests } = buildSlidesRequests(SAMPLE_DECK, { theme: getTheme("pearl"), template, learned });
  const json = JSON.stringify(requests);

  it("fills every slide with the learned background: cover style for dark slide types", () => {
    const fills = requests.filter(r => r.updatePageProperties).map(r => r.updatePageProperties!.pageProperties!.pageBackgroundFill!.solidFill!.color!.rgbColor!);
    expect(fills).toHaveLength(SAMPLE_DECK.slides.length);
    const brown = fills.filter(c => Math.round(c.red! * 255) === 0x4d).length;
    expect(brown).toBe(SAMPLE_DECK.slides.filter(s => ["title", "section", "callout", "closing"].includes(s.type)).length);
  });

  it("uses the learned fonts, not the Pearl theme's or Times", () => {
    expect(json).toContain('"fontFamily":"Calibri"');
    expect(json).toContain('"fontFamily":"Carlito"');
    expect(json).not.toContain("Georgia");
    expect(json).not.toContain("themeColor");
  });

  it("draws title and section slides itself instead of the template's plain layouts", () => {
    const creates = requests.filter(r => r.createSlide).map(r => r.createSlide!);
    expect(creates.every(c => c.slideLayoutReference?.layoutId === "l")).toBe(true);
  });

  it("keeps big panels square, since Slides corners grow with the shape", () => {
    const shapes = requests.filter(r => r.createShape && r.createShape.shapeType !== "TEXT_BOX").map(r => r.createShape!);
    for (const s of shapes.filter(s => s.shapeType === "ROUND_RECTANGLE")) {
      const { width, height } = s.elementProperties!.size!;
      expect(Math.min(width!.magnitude!, height!.magnitude!)).toBeLessThanOrEqual(28);
    }
    expect(shapes.some(s => s.shapeType === "RECTANGLE")).toBe(true);
  });
});

describe("slidesFont", () => {
  it("skips fonts Google Slides can't render", () => {
    expect(slidesFont("'Segoe UI', Arial, sans-serif")).toBe("Arial");
    expect(slidesFont("'Inter', 'Segoe UI', sans-serif")).toBe("Inter");
    expect(slidesFont("'Some Brand Serif', serif")).toBe("Georgia");
  });
});
