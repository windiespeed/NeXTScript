export type ThemeCategory = "light" | "dark" | "vibrant";

export interface ThemeConfig {
  id: string;
  name: string;
  category: ThemeCategory;
  background: {
    /** Backdrop behind the slide surface — visible as letterboxing in the deck viewer. */
    page: string;
    /** The slide's own surface color. */
    card: string;
    /** Secondary panel color — split-column cards, step-grid cards, callout panels. */
    cardAlt: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    headingWeight: number;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  accent: {
    primary: string;
    secondary: string;
    /** Third semantic accent — used where callouts/badges need to distinguish three categories at once. */
    tertiary: string;
  };
  border: string;
  /** Tailwind-arbitrary-value-compatible corner radius, e.g. "1.5rem". */
  radius: string;
}
