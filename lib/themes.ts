import type { ThemeConfig } from "@/types/theme";

export const THEMES: ThemeConfig[] = [
  {
    // The program's own look, from the NeXTStack course decks: navy content slides, brown title and
    // section slides, warm orange accents, Calibri. The default when a course has no Slides template.
    id: "nextstack",
    name: "NeXTStack",
    category: "dark",
    background: { page: "#4D3522", card: "#262E3E", cardAlt: "#1D2026" },
    typography: { headingFont: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif", bodyFont: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif", headingWeight: 700 },
    text: { primary: "#E8EAED", secondary: "#E8EAED", muted: "#A4A8B0" },
    accent: { primary: "#F2A365", secondary: "#F2777A", tertiary: "#6EA8FE" },
    border: "#2C3038",
    radius: "0.25rem",
    // Navy gradient on content slides, warm brown glow on cover/section slides (from the course decks).
    backdrop: "nextstack",
    darkSlides: {
      surface: "#4D3522",
      panel: "#3A2819",
      text: { primary: "#E8EAED", secondary: "#E8EAED", muted: "#B2ABA6" },
      accent: { primary: "#F2A365", secondary: "#F2777A", tertiary: "#6EA8FE" },
    },
  },
  {
    // No styling at all: exports to Google Slides on Google's own layouts with no colors, fonts or
    // backgrounds, so any Google Slides theme applied afterwards restyles the whole deck.
    id: "plain",
    name: "Plain (no theme)",
    category: "light",
    background: { page: "#ffffff", card: "#ffffff", cardAlt: "#f1f3f4" },
    typography: { headingFont: "Arial, sans-serif", bodyFont: "Arial, sans-serif", headingWeight: 400 },
    text: { primary: "#000000", secondary: "#202124", muted: "#5f6368" },
    accent: { primary: "#202124", secondary: "#5f6368", tertiary: "#5f6368" },
    border: "#dadce0",
    radius: "0",
    plain: true,
  },
  {
    id: "pearl",
    name: "Pearl",
    category: "light",
    background: { page: "#f7f5f2", card: "#ffffff", cardAlt: "#f1eee8" },
    typography: { headingFont: "Georgia, 'Times New Roman', serif", bodyFont: "'Segoe UI', Arial, sans-serif", headingWeight: 700 },
    text: { primary: "#1f2937", secondary: "#4b5563", muted: "#9ca3af" },
    accent: { primary: "#0f766e", secondary: "#b8860b", tertiary: "#7c3aed" },
    border: "#e5e1d8",
    radius: "1.5rem",
  },
  {
    id: "vortex",
    name: "Vortex",
    category: "dark",
    background: { page: "#05060a", card: "#0d0f1a", cardAlt: "#161a2c" },
    typography: { headingFont: "'Poppins', 'Segoe UI', sans-serif", bodyFont: "'Inter', 'Segoe UI', sans-serif", headingWeight: 800 },
    text: { primary: "#f1f5f9", secondary: "#c7d2fe", muted: "#6b7280" },
    accent: { primary: "#22d3ee", secondary: "#e879f9", tertiary: "#fbbf24" },
    border: "rgba(255,255,255,0.08)",
    radius: "1.25rem",
  },
  {
    id: "clementa",
    name: "Clementa",
    category: "light",
    background: { page: "#fdf3e7", card: "#fffaf3", cardAlt: "#fbe8d3" },
    typography: { headingFont: "'Fraunces', Georgia, serif", bodyFont: "'Segoe UI', Arial, sans-serif", headingWeight: 600 },
    text: { primary: "#3a2a1d", secondary: "#6b4f3a", muted: "#a3876d" },
    accent: { primary: "#d2691e", secondary: "#b6482f", tertiary: "#4d7c0f" },
    border: "#f0dcc0",
    radius: "1.75rem",
  },
  {
    id: "twilight",
    name: "Twilight",
    category: "dark",
    background: { page: "#0b0a1f", card: "#151330", cardAlt: "#1e1b45" },
    typography: { headingFont: "'Playfair Display', Georgia, serif", bodyFont: "'Segoe UI', Arial, sans-serif", headingWeight: 700 },
    text: { primary: "#ede9fe", secondary: "#c4b5fd", muted: "#8b83b0" },
    accent: { primary: "#818cf8", secondary: "#f472b6", tertiary: "#fbbf24" },
    border: "rgba(196,181,253,0.15)",
    radius: "1.5rem",
  },
];

export const DEFAULT_THEME_ID = "nextstack";

export function getTheme(id: string | undefined): ThemeConfig {
  return THEMES.find(t => t.id === id) ?? THEMES.find(t => t.id === DEFAULT_THEME_ID)!;
}
