import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { THEMES, getTheme } from "@/lib/themes";
import { DECK_SLIDE_TYPES, DeckSchema, layoutConcept } from "@/lib/deck";
import { SAMPLE_DECK } from "@/lib/deck/sample";
import { mix, resolvePalette } from "@/lib/deck/render/palette";
import SlideCanvas from "@/components/deck/SlideCanvas";
import DeckPreview, { layoutEntries } from "@/components/deck/DeckPreview";

const TOKENS = ["surface", "panel", "text.primary", "text.secondary", "text.muted", "accent.primary", "accent.secondary", "accent.tertiary", "code.bg", "code.text"] as const;

describe("palette", () => {
  it("mixes hex colors", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#fff", "#000", 0)).toBe("#ffffff");
    expect(mix("rgba(0,0,0,0.1)", "#ffffff", 0.5)).toBe("rgba(0,0,0,0.1)");
  });

  it.each(THEMES.map(t => [t.id, t] as const))("resolves every token for %s, light and dark", (_id, theme) => {
    for (const dark of [false, true]) {
      const p = resolvePalette(theme, dark);
      for (const t of TOKENS) expect(p[t], `${t} dark=${dark}`).toMatch(/^#|^rgb/);
    }
    expect(resolvePalette(theme, false).surface).toBe(theme.background.card);
    expect(resolvePalette(theme, true).surface).not.toBe(theme.background.card);
  });
});

describe("HTML preview", () => {
  it("sample deck is valid", () => {
    expect(DeckSchema.safeParse(SAMPLE_DECK).success).toBe(true);
  });

  it("draws every element of a concept slide, positioned in percent", () => {
    const layout = layoutConcept(SAMPLE_DECK.slides.find(s => s.id === "props") as never);
    const html = renderToStaticMarkup(<SlideCanvas layout={layout} theme={getTheme("pearl")} label="Slide 3" />);
    expect(html).toContain('aria-label="Slide 3"');
    expect(html).toContain("Props pass data down");
    expect(html).toContain("cookie cutter");
    expect(html).toContain("container-type:inline-size");
    expect(html).toMatch(/left:5\.5555/); // 40 / 720
    expect(html).not.toContain("dashed");
  });

  it("outlines elements with warnings", () => {
    const crowded = SAMPLE_DECK.slides.find(s => s.id === "crowded")!;
    const layout = layoutConcept(crowded as never);
    expect(layout.warnings.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(<SlideCanvas layout={layout} theme={getTheme("pearl")} />);
    expect(html).toContain("dashed");
    expect(renderToStaticMarkup(<SlideCanvas layout={layout} theme={getTheme("pearl")} showWarnings={false} />)).not.toContain("dashed");
  });

  it("sample deck uses all 14 slide types", () => {
    expect(new Set(SAMPLE_DECK.slides.map(s => s.type))).toEqual(new Set(DECK_SLIDE_TYPES));
  });

  it("renders the whole deck with badges and notes", () => {
    const entries = layoutEntries(SAMPLE_DECK);
    expect(entries.every(e => e.layout !== null)).toBe(true);
    const html = renderToStaticMarkup(<DeckPreview deck={SAMPLE_DECK} theme={getTheme("vortex")} />);
    expect(html).toContain(`${SAMPLE_DECK.slides.length} slides`);
    expect(html).toContain("Speaker notes");
    expect(html).not.toContain("isn&#x27;t built yet");
    expect(html).toMatch(/Shrunk|Overflow/);
  });

  it("the sample deck has warnings only on its deliberately crowded slide", () => {
    const flagged = layoutEntries(SAMPLE_DECK).filter(e => e.layout!.warnings.length > 0).map(e => e.slide.id);
    expect(flagged).toEqual(["crowded"]);
  });
});
