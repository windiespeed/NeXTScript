import { describe, expect, it } from "vitest";
import type { slides_v1 } from "googleapis";
import { learnTemplateStyle, luminance } from "@/lib/deck/render/templateStyle";
import { buildSlidesRequests, inspectTemplate, pageFrame, slidesFont, bodyFrame } from "@/lib/deck/render/googleSlides";
import { layoutSlide } from "@/lib/deck/layout/registry";
import type { TextElement } from "@/lib/deck/layout/types";
import { FOOTER_Y } from "@/lib/deck/layout/decorations";
import { GRID } from "@/lib/deck/layout/kit";
import { SAMPLE_DECK } from "@/lib/deck/sample";
import { getTheme } from "@/lib/themes";

const hex = (h: string): slides_v1.Schema$OpaqueColor => {
  const n = parseInt(h.slice(1), 16);
  return { rgbColor: { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 } };
};
const bg = (h: string): slides_v1.Schema$PageProperties => ({ pageBackgroundFill: { solidFill: { color: hex(h) } } });
const PAGE_H = 5143500;
/** A text box; `top` is its top edge as a share of the page height. */
const text = (runs: [string, string, number, string, boolean?][], top = 0.4): slides_v1.Schema$PageElement => ({
  transform: { scaleX: 1, scaleY: 1, translateX: 812800, translateY: top * PAGE_H, unit: "EMU" },
  shape: {
    shapeType: "TEXT_BOX",
    text: { textElements: runs.map(([content, font, size, color, bold]) => ({ textRun: { content, style: { fontFamily: font, fontSize: { magnitude: size, unit: "PT" }, foregroundColor: { opaqueColor: hex(color) }, bold: !!bold } } })) },
  },
});
const card = (fill: string): slides_v1.Schema$PageElement => ({
  size: { width: { magnitude: 2000000, unit: "EMU" }, height: { magnitude: 1000000, unit: "EMU" } },
  shape: { shapeType: "ROUND_RECTANGLE", shapeProperties: { shapeBackgroundFill: { solidFill: { color: hex(fill) } } } },
});

// A full-slide shape with no text: how a pptx-born deck paints its gradient background (the
// Slides API reports no fill for it, since it can't read gradients).
const gradient = (id: string): slides_v1.Schema$PageElement => ({
  objectId: id,
  size: { width: { magnitude: 9144000, unit: "EMU" }, height: { magnitude: 5143500, unit: "EMU" } },
  shape: { shapeType: "RECTANGLE" },
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
    { objectId: "s1", slideProperties: { layoutObjectId: "l", masterObjectId: "m" }, pageProperties: bg("#4D3522"), pageElements: [gradient("g1"), text([["7 PARTS", "Calibri", 9, "#F0A050", true]]), text([["Databases & Auth", "Calibri", 40, "#FFFFFF", true]]), text([["Data that survives.", "Carlito", 14, "#F3E9DC"]])] },
    ...[2, 3, 5].map(i => ({
      objectId: `s${i}`,
      slideProperties: { layoutObjectId: "l", masterObjectId: "m" },
      pageProperties: bg("#262E3E"),
      pageElements: [
        gradient(`g${i}`),
        text([["PART 1 · SQL VS NOSQL", "Calibri", 8, "#F0A050", true]], 0.12),
        text([["Two ways to store data", "Calibri", 22, "#FFFFFF", true]], 0.16),
        card("#323C50"),
        text([["Relational (SQL)", "Calibri", 12, "#6FA8FF", true], ["Tables with fixed columns, like a strict spreadsheet.", "Carlito", 11, "#D7DCE5"]]),
        text([["const x = 1", "Courier New", 10, "#A6E22E"]]),
        text([["Part 1 · From files", "Calibri", 8, "#9AA0A8"]], 0.91),
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

  it("finds each style's backdrop: the slide's full-slide, text-free elements", () => {
    const s = learnTemplateStyle(handStyled)!;
    expect(s.coverBackdrop).toMatchObject({ slideId: "s1", keep: ["g1"] });
    expect(s.contentBackdrop).toMatchObject({ slideId: "s2", keep: ["g2"] });
    expect(s.contentBackdrop!.drop).not.toContain("g2");
  });

  it("learns the label above the title and the footer line, with their color and size", () => {
    const s = learnTemplateStyle(handStyled)!;
    expect(s.label).toEqual({ color: "#F0A050", size: 8, bold: true });
    expect(s.footer).toEqual({ color: "#9AA0A8", size: 8, bold: false });
  });

  it("has no label or footer when the template's slides don't", () => {
    const plain = {
      ...handStyled,
      slides: handStyled.slides!.map(sl => ({ ...sl, pageElements: sl.pageElements!.filter(e => !/PART 1 ·|Part 1 ·/.test(e.shape?.text?.textElements?.[0]?.textRun?.content ?? "")) })),
    };
    const s = learnTemplateStyle(plain)!;
    expect(s.label).toBeUndefined();
    expect(s.footer).toBeUndefined();
  });

  it("keeps a logo that sits in the same spot on most slides, but not a one-off picture", () => {
    const logo = (id: string): slides_v1.Schema$PageElement => ({
      objectId: id,
      size: { width: { magnitude: 600000, unit: "EMU" }, height: { magnitude: 300000, unit: "EMU" } },
      transform: { scaleX: 1, scaleY: 1, translateX: 8400000, translateY: 4700000, unit: "EMU" },
      image: { contentUrl: "https://example.com/logo.png" },
    });
    const photo: slides_v1.Schema$PageElement = {
      objectId: "photo",
      size: { width: { magnitude: 3000000, unit: "EMU" }, height: { magnitude: 2000000, unit: "EMU" } },
      transform: { scaleX: 1, scaleY: 1, translateX: 500000, translateY: 1500000, unit: "EMU" },
      image: { contentUrl: "https://example.com/photo.png" },
    };
    const withLogo = {
      ...handStyled,
      slides: handStyled.slides!.map((sl, i) => ({ ...sl, pageElements: [...sl.pageElements!, logo(`logo${i}`), ...(sl.objectId === "s2" ? [photo] : [])] })),
    };
    const s = learnTemplateStyle(withLogo)!;
    expect(s.contentBackdrop!.keep).toEqual(["g2", "logo1"]);
    expect(s.contentBackdrop!.drop).toContain("photo");
    expect(s.coverBackdrop!.keep).toEqual(["g1", "logo0"]);
  });

  it("learns the template's margins and header and footer positions", () => {
    const f = learnTemplateStyle(handStyled)!.frame!;
    expect(f.left).toBeCloseTo(64, 0); // 812800 EMU
    expect(f.top).toBeCloseTo((0.12 * PAGE_H) / 12700, 0);
    expect(f.footerTop).toBeCloseTo((0.91 * PAGE_H) / 12700, 0);
    expect(f.titleTop).toBeCloseTo((0.16 * PAGE_H) / 12700, 0);
  });

  it("puts content-slide titles where the template's titles sit and shifts the body with them", () => {
    const frame = learnTemplateStyle(handStyled)!.frame!;
    const f = pageFrame(720, 405, frame);
    const concept = SAMPLE_DECK.slides.find(s => s.type === "concept")!;
    const layout = layoutSlide({ ...concept, label: "Part 1 · Loops" });
    const title = layout.elements.find(e => e.id === "title") as TextElement;
    const b = bodyFrame(layout, f, frame);
    expect(b.oy + title.y * b.ky).toBeCloseTo(frame.titleTop!);
    // The body still ends where it did, and text keeps its size.
    expect(b.oy + GRID.bodyBottom * b.ky).toBeCloseTo(f.oy + GRID.bodyBottom * f.ky);
    expect(b.k).toBe(f.k);
    // Cover slides and templates without a learned title spot keep the page frame.
    expect(bodyFrame({ ...layout, dark: true }, f, frame)).toBe(f);
    expect(bodyFrame(layout, f, { ...frame, titleTop: undefined })).toBe(f);
  });

  it("maps the layout's content box onto the learned frame", () => {
    const frame = { left: 64, top: 64, footerTop: 491 };
    const f = pageFrame(960, 540, frame);
    expect(f.ox + GRID.marginX * f.kx).toBeCloseTo(64);
    expect(f.ox + (GRID.marginX + GRID.contentW) * f.kx).toBeCloseTo(960 - 64);
    expect(f.oy + GRID.top * f.ky).toBeCloseTo(64);
    expect(f.oy + FOOTER_Y * f.ky).toBeCloseTo(491);
    // Without a frame the canvas just scales to the page.
    expect(pageFrame(960, 540)).toMatchObject({ ox: 0, oy: 0, kx: 960 / 720, ky: 540 / 405 });
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

  it("copies the template's backdrop slides so gradients carry over, then drops their other elements", () => {
    const dups = requests.filter(r => r.duplicateObject).map(r => r.duplicateObject!);
    expect(dups).toHaveLength(SAMPLE_DECK.slides.length);
    const dark = SAMPLE_DECK.slides.map(s => ["title", "section", "callout", "closing"].includes(s.type));
    dups.forEach((d, i) => expect(d.objectId).toBe(dark[i] ? "s1" : "s2"));
    // Every non-backdrop element of the copy is deleted; the gradient copy is kept.
    const deleted = new Set(requests.filter(r => r.deleteObject).map(r => r.deleteObject!.objectId));
    for (const d of dups) {
      for (const [src, copy] of Object.entries(d.objectIds!)) {
        if (src === d.objectId) continue;
        expect(deleted.has(copy), src).toBe(!src.startsWith("g"));
      }
    }
    // Each copy is moved to the end, in deck order (one past, since it counts itself).
    const moves = requests.filter(r => r.updateSlidesPosition).map(r => r.updateSlidesPosition!.insertionIndex);
    expect(moves).toEqual(SAMPLE_DECK.slides.map((_, i) => 5 + i + 1));
    expect(requests.some(r => r.createSlide)).toBe(false);
  });

  it("draws the generator's labels and footers in the template's color and size, or leaves them out", () => {
    const deck = { ...SAMPLE_DECK, slides: SAMPLE_DECK.slides.map(sl => ({ ...sl, label: "Part 1 · Loops", footer: "Part 1 · Repeating code" })) };
    const drawn = JSON.stringify(buildSlidesRequests(deck, { theme: getTheme("pearl"), template, learned }).requests);
    expect(drawn).toContain("PART 1 · LOOPS");
    expect(drawn).toContain("Part 1 · Repeating code");
    const without = JSON.stringify(buildSlidesRequests(deck, { theme: getTheme("pearl"), template, learned: { ...learned, label: undefined, footer: undefined } }).requests);
    expect(without).not.toContain("PART 1 · LOOPS");
    expect(without).not.toContain("Repeating code");
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
