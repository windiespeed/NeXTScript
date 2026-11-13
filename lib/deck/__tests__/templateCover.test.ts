import { describe, expect, it } from "vitest";
import type { slides_v1 } from "googleapis";
import { learnCover, learnTemplateStyle } from "@/lib/deck/render/templateStyle";
import { buildSlidesRequests, inspectTemplate } from "@/lib/deck/render/googleSlides";
import { fitCoverSize, layoutTemplateCover, type TemplateCover } from "@/lib/deck/layout/templateCover";
import { layoutOptionsForTheme, layoutSlide } from "@/lib/deck/layout/registry";
import { themeFromLearned } from "@/lib/deck/render/templateStyle";
import { getTheme } from "@/lib/themes";
import type { SlideOf } from "@/lib/deck/schema";

const W = 12192000;
const H = 6858000;
const hex = (h: string): slides_v1.Schema$OpaqueColor => {
  const n = parseInt(h.slice(1), 16);
  return { rgbColor: { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 } };
};
const box = (id: string, x: number, y: number, w: number, h: number, text: string, size: number, color: string, bold = false, align = "START"): slides_v1.Schema$PageElement => ({
  objectId: id,
  size: { width: { magnitude: w, unit: "EMU" }, height: { magnitude: h, unit: "EMU" } },
  transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: "EMU" },
  shape: {
    shapeType: "TEXT_BOX",
    shapeProperties: { contentAlignment: "TOP" },
    text: {
      textElements: [
        { paragraphMarker: { style: { alignment: align } } },
        { textRun: { content: text, style: { fontFamily: "Carlito", fontSize: { magnitude: size, unit: "PT" }, foregroundColor: { opaqueColor: hex(color) }, bold } } },
      ],
    },
  },
});
const pic = (id: string, x: number, y: number, w: number, h: number): slides_v1.Schema$PageElement => ({
  objectId: id,
  size: { width: { magnitude: w, unit: "EMU" }, height: { magnitude: h, unit: "EMU" } },
  transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: "EMU" },
  image: { contentUrl: "https://example.com/seal.png" },
});
const full = (id: string): slides_v1.Schema$PageElement => ({ objectId: id, size: { width: { magnitude: W, unit: "EMU" }, height: { magnitude: H, unit: "EMU" } }, shape: { shapeType: "RECTANGLE" } });
const bg = (h: string): slides_v1.Schema$PageProperties => ({ pageBackgroundFill: { solidFill: { color: hex(h) } } });

// Shaped like Windie's NeXTStack template cover: label, two-line title, subtitle, a one-off
// footer line, the MCA seal on the right and a small logo in the corner.
const coverSlide: slides_v1.Schema$Page = {
  objectId: "p14",
  slideProperties: { layoutObjectId: "l", masterObjectId: "m" },
  pageProperties: bg("#AF7B51"),
  pageElements: [
    full("g135"),
    box("t136", 812782, 812782, 10883429, 274259, "7 PARTS", 14, "#F2A365", true),
    box("t137", 812782, 1315641, 10883429, 1625528, "Databases & Auth", 60, "#E8EAED", true),
    box("t138", 812782, 3169768, 10883429, 736528, "Data that survives. Counts that stay honest.", 20, "#E8EAED"),
    box("t139", 812782, 5796359, 10883429, 274259, "SoundWave becomes a store: MongoDB · PostgreSQL", 14, "#E8EAED"),
    pic("seal", 6756950, 1087050, 4317249, 4317249),
    pic("logo", 10365900, 5667513, 1330301, 531950),
  ],
};
const content = (i: number): slides_v1.Schema$Page => ({
  objectId: `c${i}`,
  slideProperties: { layoutObjectId: "l", masterObjectId: "m" },
  pageProperties: bg("#262E3E"),
  pageElements: [full(`gc${i}`), box(`ct${i}`, 721342, 1000000, 10749300, 500000, "A content headline", 28, "#FFFFFF", true), box(`cb${i}`, 721342, 2000000, 10749300, 2000000, "Body text here", 16, "#D7DCE5")],
});
const pres: slides_v1.Schema$Presentation = {
  pageSize: { width: { magnitude: W, unit: "EMU" }, height: { magnitude: H, unit: "EMU" } },
  masters: [{ objectId: "m", pageProperties: { colorScheme: { colors: [] } } }],
  layouts: [{ objectId: "l", layoutProperties: { name: "DEFAULT", masterObjectId: "m" }, pageElements: [] }],
  slides: [coverSlide, content(1), content(2), content(3)],
};

const titleSlide: SlideOf<"title"> = { id: "cover", type: "title", title: "Test 2 Lesson 2", subtitle: "Intro to JavaScript", kicker: "Lesson 2", notes: "Welcome." } as SlideOf<"title">;

describe("learnCover", () => {
  const cover = learnTemplateStyle(pres)!.titleCover!;

  it("finds the cover's title, label and subtitle boxes with their style", () => {
    expect(cover.slideId).toBe("p14");
    expect(cover.pageW).toBeCloseTo(960);
    expect(cover.title).toMatchObject({ objectId: "t137", size: 60, color: "#E8EAED", bold: true, font: "Carlito", align: "left", valign: "top" });
    expect(cover.kicker).toMatchObject({ objectId: "t136", size: 14, color: "#F2A365", uppercase: true });
    expect(cover.subtitle).toMatchObject({ objectId: "t138", size: 20, bold: false });
    expect(cover.otherText).toEqual(["t139"]);
  });

  it("narrows boxes that run under the seal so they end just before it", () => {
    const sealX = 6756950 / W;
    expect(cover.title.w).toBeCloseTo(sealX - 0.02 - 812782 / W);
    expect(cover.subtitle!.w).toBeCloseTo(sealX - 0.02 - 812782 / W);
    expect(cover.title.resize).toMatchObject({ nativeWidth: 10883429 });
    // The label sits above the seal, so it keeps its full width.
    expect(cover.kicker!.resize).toBeUndefined();
    expect(cover.kicker!.w).toBeCloseTo(10883429 / W);
  });

  it("reads centered text", () => {
    const centered = { ...coverSlide, pageElements: [box("t", 0, 2000000, W, 1000000, "Title", 48, "#FFFFFF", true, "CENTER")] };
    expect(learnCover(centered, new Map(), W, H)!.title.align).toBe("center");
  });
});

describe("title slide on the template's own cover", () => {
  const learned = learnTemplateStyle(pres)!;
  const template = inspectTemplate(pres);
  const deck = { title: "x", slides: [titleSlide] } as never;
  const { requests } = buildSlidesRequests(deck, { theme: getTheme("nextstack"), template, learned });

  it("copies the template's first slide with every picture and shape, and drops its other text", () => {
    const dup = requests.find(r => r.duplicateObject)!.duplicateObject!;
    expect(dup.objectId).toBe("p14");
    const deleted = new Set(requests.filter(r => r.deleteObject).map(r => r.deleteObject!.objectId));
    expect(deleted.has(dup.objectIds!.t139)).toBe(true);
    for (const id of ["t136", "t137", "t138"]) expect(deleted.has(dup.objectIds![id])).toBe(false);
    // Pictures and the gradient aren't touched (and aren't in the delete list).
    expect([...deleted].some(id => /seal|logo|g135/.test(id ?? ""))).toBe(false);
    expect(requests.some(r => r.createShape)).toBe(false);
  });

  it("writes the deck's text into the template's boxes in the template's style", () => {
    const dup = requests.find(r => r.duplicateObject)!.duplicateObject!;
    const inserted = Object.fromEntries(requests.filter(r => r.insertText).map(r => [r.insertText!.objectId, r.insertText!.text]));
    expect(inserted[dup.objectIds!.t137]).toBe("Test 2 Lesson 2");
    expect(inserted[dup.objectIds!.t138]).toBe("Intro to JavaScript");
    expect(inserted[dup.objectIds!.t136]).toBe("LESSON 2");
    const titleStyle = requests.find(r => r.updateTextStyle?.objectId === dup.objectIds!.t137)!.updateTextStyle!;
    expect(titleStyle.style!.fontSize!.magnitude).toBeLessThanOrEqual(60);
    expect(titleStyle.style!.fontSize!.magnitude).toBeGreaterThanOrEqual(45);
    expect(titleStyle.style!.fontFamily).toBe("Carlito");
    expect(titleStyle.style!.bold).toBe(true);
    const resize = requests.find(r => r.updatePageElementTransform?.objectId === dup.objectIds!.t137)!.updatePageElementTransform!;
    expect(resize.applyMode).toBe("ABSOLUTE");
    expect(resize.transform!.translateX).toBe(812782);
    expect(resize.transform!.scaleX! * 10883429).toBeCloseTo((6756950 / W - 0.02 - 812782 / W) * W, -2);
  });

  it("shrinks text only when it wouldn't fit the box", () => {
    const cover = learned.titleCover as TemplateCover;
    expect(fitCoverSize("Short", cover.title, "title", cover)).toBe(60);
    const long = "A very long lesson title that keeps going well past what the template's title box was drawn for";
    const size = fitCoverSize(long, cover.title, "title", cover);
    expect(size).toBeLessThan(60);
    expect(size).toBeGreaterThanOrEqual(36);
  });

  it("previews the same boxes, exact colors and sizes", () => {
    const theme = themeFromLearned(learned);
    const layout = layoutSlide(titleSlide, layoutOptionsForTheme(theme));
    expect(layout).toEqual(layoutTemplateCover(titleSlide, learned.titleCover!));
    const title = layout.elements.find(e => e.id === "title")!;
    expect(title.kind === "text" && title.hex).toBe("#E8EAED");
    expect(title.kind === "text" && title.fontSize).toBeCloseTo(fitCoverSize("Test 2 Lesson 2", learned.titleCover!.title, "title", learned.titleCover!) * (720 / 960));
    expect(title.x).toBeCloseTo((812782 / W) * 720 + 7.2 * 0.75);
  });

  it("isn't used for a template whose first slide is just a content slide", () => {
    const plain = { ...pres, slides: [content(0), content(1), content(2)] };
    expect(learnTemplateStyle(plain)!.titleCover).toBeUndefined();
  });
});
