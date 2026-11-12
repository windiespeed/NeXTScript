import { describe, expect, it } from "vitest";
import { themeFromLearned, type LearnedStyle } from "@/lib/deck/render/templateStyle";
import { resolvePalette } from "@/lib/deck/render/palette";

const pal = (bg: string, accent: string) => ({ background: bg, title: "#FFFFFF", body: "#D7DCE5", muted: "#9AA0A8", accent1: accent, accent2: "#6FA8FF", accent3: accent, panel: "#323C50" });
const style: LearnedStyle = { content: pal("#262E3E", "#F0A050"), cover: pal("#4D3522", "#F0A050"), headingFont: "Calibri", bodyFont: "Carlito" };

describe("themeFromLearned", () => {
  const theme = themeFromLearned(style, "Databases & Auth");

  it("draws content slides in the template's content colors and fonts", () => {
    const p = resolvePalette(theme);
    expect(p.surface).toBe("#262E3E");
    expect(p.panel).toBe("#323C50");
    expect(p["accent.primary"].toUpperCase()).toBe("#F0A050");
    expect(theme.typography.headingFont).toMatch(/^"Calibri"/);
    expect(theme.typography.bodyFont).toMatch(/^"Carlito"/);
    expect(theme.name).toBe("Databases & Auth");
  });

  it("draws title, section and callout slides in the template's cover colors", () => {
    expect(resolvePalette(theme, true).surface).toBe("#4D3522");
  });
});

describe("themeFromLearned colors are exact", () => {
  it("keeps the template's light cover text even where the contrast fix would darken it", () => {
    // The cover's page color is a mid brown, but the template draws a dark gradient over it, and
    // the export uses the template's light text as is. The preview must too.
    const brown: LearnedStyle = { content: pal("#262E3E", "#F0A050"), cover: { ...pal("#AF7B51", "#F0A050"), title: "#E8EAED" } };
    const p = resolvePalette(themeFromLearned(brown), true);
    expect(p["text.primary"]).toBe("#E8EAED");
  });
});
