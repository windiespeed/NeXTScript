import { describe, expect, it } from "vitest";
import { THEMES } from "@/lib/themes";
import { resolvePalette } from "@/lib/deck/render/palette";

// WCAG 2.x relative luminance / contrast ratio. Slides are projected, often in bright rooms,
// so every text color must reach 4.5:1 on the backgrounds it sits on.
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const TEXT = ["text.primary", "text.secondary", "text.muted", "accent.primary", "accent.secondary", "accent.tertiary"] as const;

describe("slide palette contrast", () => {
  for (const theme of THEMES) {
    for (const dark of [false, true]) {
      const p = resolvePalette(theme, dark);
      for (const bg of ["surface", "panel"] as const) {
        for (const fg of TEXT) {
          it(`${theme.id}${dark ? " (dark slide)" : ""}: ${fg} on ${bg}`, () => {
            expect(contrast(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5);
          });
        }
      }
      it(`${theme.id}${dark ? " (dark slide)" : ""}: code label on code panel`, () => {
        expect(contrast(p["code.label"], p["code.bg"])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
