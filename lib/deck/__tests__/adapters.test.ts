import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import type { slides_v1 } from "googleapis";
import { getTheme } from "@/lib/themes";
import { SAMPLE_DECK } from "@/lib/deck/sample";
import { buildDeckPptx, firstFont } from "@/lib/deck/render/pptx";
import { buildSlidesRequests, inspectTemplate, presentationIdFromUrl } from "@/lib/deck/render/googleSlides";

describe("pptx adapter", () => {
  it("reads the first family from a CSS font stack", () => {
    expect(firstFont("'Inter', 'Segoe UI', sans-serif")).toBe("Inter");
    expect(firstFont("Georgia, serif")).toBe("Georgia");
    expect(firstFont("")).toBe("Arial");
  });

  it("writes one slide per deck slide, each with its speaker notes", async () => {
    const buffer = await buildDeckPptx(SAMPLE_DECK, getTheme("clementa"));
    const zip = await JSZip.loadAsync(buffer);
    const slides = Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides).toHaveLength(SAMPLE_DECK.slides.length);
    const notes = Object.keys(zip.files).filter(f => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f));
    expect(notes).toHaveLength(SAMPLE_DECK.slides.length);
    const firstNotes = await zip.file("ppt/notesSlides/notesSlide1.xml")!.async("string");
    expect(firstNotes).toContain("Welcome everyone back");
    const codeSlide = SAMPLE_DECK.slides.findIndex(s => s.type === "code") + 1;
    const xml = await zip.file(`ppt/slides/slide${codeSlide}.xml`)!.async("string");
    expect(xml).toContain("Greeting");
    expect(xml).toContain("Cascadia Code");
  }, 20000);
});

const flat = (reqs: slides_v1.Schema$Request[]) => reqs.map(r => Object.keys(r)[0]);

describe("Google Slides adapter", () => {
  it("finds the presentation id in a Slides URL", () => {
    expect(presentationIdFromUrl("https://docs.google.com/presentation/d/abc_DEF-123/edit#slide=id.p")).toBe("abc_DEF-123");
    expect(presentationIdFromUrl("https://example.com")).toBeUndefined();
    expect(presentationIdFromUrl(undefined)).toBeUndefined();
  });

  it("draws every slide in the theme's colors without a template", () => {
    const { requests, slideIds, notes } = buildSlidesRequests(SAMPLE_DECK, { theme: getTheme("pearl") });
    expect(flat(requests).filter(k => k === "createSlide")).toHaveLength(SAMPLE_DECK.slides.length);
    expect(slideIds).toHaveLength(SAMPLE_DECK.slides.length);
    expect(notes).toEqual(SAMPLE_DECK.slides.map(s => s.notes));
    // Object ids: 5–50 chars, starting with a letter or underscore, all unique.
    const ids = requests.flatMap(r => [r.createSlide?.objectId, r.createShape?.objectId]).filter(Boolean) as string[];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z_][\w-]{4,49}$/);
    // Every page gets a background, and colors are rgb.
    expect(flat(requests).filter(k => k === "updatePageProperties")).toHaveLength(SAMPLE_DECK.slides.length);
    expect(JSON.stringify(requests)).not.toContain("themeColor");
  });

  it("keeps style and bullet ranges inside each text box's text", () => {
    const { requests } = buildSlidesRequests(SAMPLE_DECK, { theme: getTheme("vortex") });
    const lengths = new Map<string, number>();
    for (const r of requests) if (r.insertText?.objectId) lengths.set(r.insertText.objectId, r.insertText.text!.length);
    for (const r of requests) {
      const op = r.updateTextStyle ?? r.createParagraphBullets;
      const range = op?.textRange;
      if (range?.type !== "FIXED_RANGE") continue;
      const len = lengths.get(op!.objectId!)!;
      expect(range.startIndex!).toBeGreaterThanOrEqual(0);
      expect(range.endIndex!).toBeLessThanOrEqual(len);
      expect(range.endIndex!).toBeGreaterThan(range.startIndex!);
    }
    expect(flat(requests)).toContain("createParagraphBullets");
  });

  const templatePresentation: slides_v1.Schema$Presentation = {
    pageSize: { width: { magnitude: 9144000, unit: "EMU" }, height: { magnitude: 5143500, unit: "EMU" } },
    slides: [{ objectId: "sample1" }, { objectId: "sample2" }],
    masters: [
      {
        objectId: "m",
        pageElements: [
          { shape: { placeholder: { type: "TITLE" }, text: { textElements: [{ textRun: { content: "x", style: { fontFamily: "Montserrat" } } }] } } },
          { shape: { placeholder: { type: "BODY" }, text: { textElements: [{ textRun: { content: "x", style: { fontFamily: "Lato" } } }] } } },
        ],
      },
    ],
    layouts: [
      { objectId: "lt", layoutProperties: { name: "TITLE", displayName: "Title slide" }, pageElements: [{ shape: { placeholder: { type: "CENTERED_TITLE" } } }, { shape: { placeholder: { type: "SUBTITLE" } } }] },
      { objectId: "ls", layoutProperties: { name: "SECTION_HEADER", displayName: "Section header" }, pageElements: [{ shape: { placeholder: { type: "TITLE" } } }] },
      { objectId: "lc", layoutProperties: { name: "TITLE_AND_BODY" }, pageElements: [{ shape: { placeholder: { type: "TITLE" } } }, { shape: { placeholder: { type: "BODY" } } }] },
      { objectId: "lb", layoutProperties: { name: "BLANK", displayName: "Blank" }, pageElements: [] },
    ],
  };

  it("reads a template's layouts, fonts and page size", () => {
    const info = inspectTemplate(templatePresentation);
    expect(info).toMatchObject({
      blankLayoutId: "lb",
      titleLayout: { layoutId: "lt", title: "CENTERED_TITLE", subtitle: "SUBTITLE" },
      sectionLayout: { layoutId: "ls", title: "TITLE" },
      headingFont: "Montserrat",
      bodyFont: "Lato",
      pageW: 720,
      pageH: 405,
      existingSlideIds: ["sample1", "sample2"],
    });
  });

  it("draws onto a template: its title layouts, theme colors and fonts, then removes its sample slides", () => {
    const template = inspectTemplate(templatePresentation);
    const { requests } = buildSlidesRequests(SAMPLE_DECK, { theme: getTheme("pearl"), template });
    const creates = requests.filter(r => r.createSlide).map(r => r.createSlide!);
    const types = SAMPLE_DECK.slides.map(s => s.type);
    creates.forEach((c, i) => {
      const expected = types[i] === "title" ? "lt" : types[i] === "section" ? "ls" : "lb";
      expect(c.slideLayoutReference?.layoutId, `${i} ${types[i]}`).toBe(expected);
      expect(c.insertionIndex).toBe(2 + i);
    });
    const title = requests.find(r => r.insertText?.text === "React components and props");
    expect(title).toBeDefined();
    expect(requests.some(r => r.insertText?.text === "Week 6 · Day 2 · Breaking a page into reusable pieces")).toBe(true);

    const json = JSON.stringify(requests);
    expect(json).toContain('"themeColor":"ACCENT1"');
    expect(json).toContain("Montserrat");
    expect(json).toContain("Lato");
    // Light slides keep the template background; only dark slides (callout, closing) get one.
    const drawnDark = SAMPLE_DECK.slides.filter(s => s.type === "callout" || s.type === "closing").length;
    expect(flat(requests).filter(k => k === "updatePageProperties")).toHaveLength(drawnDark);
    expect(requests.slice(-2)).toEqual([{ deleteObject: { objectId: "sample1" } }, { deleteObject: { objectId: "sample2" } }]);
  });

  it("scales the layout to a template that isn't 720×405", () => {
    const big = { ...templatePresentation, pageSize: { width: { magnitude: 960, unit: "PT" }, height: { magnitude: 540, unit: "PT" } } };
    const { requests } = buildSlidesRequests({ lessonTitle: "x", slides: [SAMPLE_DECK.slides[4]] }, { theme: getTheme("pearl"), template: inspectTemplate(big) });
    const accent = requests.find(r => r.createShape?.shapeType === "ROUND_RECTANGLE")!.createShape!;
    expect(accent.elementProperties!.transform!.translateX).toBeCloseTo(40 * (960 / 720));
  });
});
