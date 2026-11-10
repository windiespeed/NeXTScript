/**
 * Resolves the layout registry's color tokens against a ThemeConfig.
 *
 * Every adapter (HTML preview, pptx, Google Slides) goes through this, so a slide gets the same
 * colors everywhere. Dark slide types (title, section, callout, closing) get an inverted palette
 * built from the same theme, so they stay on-brand under light themes too.
 */

import type { ThemeConfig } from "@/types/theme";
import type { ColorToken } from "../layout/types";

export type Palette = Record<ColorToken, string>;

export const CODE_BG = "#0d1117";
export const CODE_TEXT = "#e6edf3";

function parseHex(color: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Blends `a` toward `b` by `t` (0–1). Returns `a` unchanged if either isn't a hex color. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  return (
    "#" +
    pa
      .map((c, i) => Math.round(c + (pb[i] - c) * t))
      .map(c => c.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function resolvePalette(theme: ThemeConfig, dark = false): Palette {
  const accents = {
    "accent.primary": theme.accent.primary,
    "accent.secondary": theme.accent.secondary,
    "accent.tertiary": theme.accent.tertiary,
    "code.bg": CODE_BG,
    "code.text": CODE_TEXT,
  };

  if (!dark) {
    return {
      surface: theme.background.card,
      panel: theme.background.cardAlt,
      "text.primary": theme.text.primary,
      "text.secondary": theme.text.secondary,
      "text.muted": theme.text.muted,
      ...accents,
    };
  }

  // Dark themes already have a dark surface: use the deeper page color so dark slides still read
  // as a change of pace. Light themes use their own ink color as the surface and paper as text.
  if (theme.category === "dark") {
    return {
      surface: theme.background.page,
      panel: theme.background.card,
      "text.primary": theme.text.primary,
      "text.secondary": theme.text.secondary,
      "text.muted": theme.text.muted,
      ...accents,
    };
  }
  const surface = theme.text.primary;
  return {
    surface,
    panel: mix(surface, "#ffffff", 0.1),
    "text.primary": theme.background.card,
    "text.secondary": mix(theme.background.card, surface, 0.2),
    "text.muted": mix(theme.background.card, surface, 0.45),
    // Light-theme accents are tuned for light paper; lift them so they read on the dark surface.
    "accent.primary": mix(theme.accent.primary, "#ffffff", 0.35),
    "accent.secondary": mix(theme.accent.secondary, "#ffffff", 0.35),
    "accent.tertiary": mix(theme.accent.tertiary, "#ffffff", 0.35),
    "code.bg": CODE_BG,
    "code.text": CODE_TEXT,
  };
}

export const CODE_FONT = "'Cascadia Code', 'Fira Code', Consolas, 'Courier New', monospace";

export function fontFamily(theme: ThemeConfig, role: "heading" | "body" | "code"): string {
  if (role === "code") return CODE_FONT;
  return role === "heading" ? theme.typography.headingFont : theme.typography.bodyFont;
}
