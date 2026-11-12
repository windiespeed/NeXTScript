export type SlideType = 'standard' | 'split-column' | 'code-explainer' | 'callout' | 'step-grid' | 'card-row' | 'table';

export interface BaseSlide {
  id: string;
  type: SlideType;
  title: string;
  subtitle?: string;
  /** Set when this slide is a locked course anchor (a SectionDef id — see lib/slideAnchors.ts).
   * Its title is the exact course section label; the editor won't rename or delete it. */
  anchorId?: string;
  /** Small label above the title, naming the course section this slide belongs to (e.g.
   * "Guided Activity"). Set from the course Sections by applySlideAnchors on anchored slides and
   * the supporting slides that follow them, so the title itself can be a real headline. */
  label?: string;
  /** Speaker notes: what the instructor says, asks, or watches for. Never shown on the slide. */
  notes?: string;
  /** One short sentence drawn at the bottom of the slide: the point students should leave with. */
  takeaway?: string;
}

export interface StandardTextSlide extends BaseSlide {
  type: 'standard';
  paragraphs: string[];
  bulletPoints?: string[];
}

export interface SplitColumnSlide extends BaseSlide {
  type: 'split-column';
  leftColumn: {
    heading: string;
    content: string[];
  };
  rightColumn: {
    heading: string;
    content: string[];
  };
}

export interface CodeExplainerSlide extends BaseSlide {
  type: 'code-explainer';
  language: string;
  codeSnippet: string;
  explanationPoints: string[];
  /** What running the code prints or shows, drawn in a console panel under the code. */
  output?: string;
}

export interface CalloutCardSlide extends BaseSlide {
  type: 'callout';
  variant: 'warning' | 'tip' | 'instructor-note';
  content: string;
}

export interface StepGridSlide extends BaseSlide {
  type: 'step-grid';
  steps: {
    stepNumber: number;
    title: string;
    description: string;
  }[];
}

/** A row of 2–4 cards, each with an optional small tag chip (e.g. "Structure"). */
export interface CardRowSlide extends BaseSlide {
  type: 'card-row';
  cards: {
    tag?: string;
    heading: string;
    body: string;
  }[];
}

/** A small comparison table: a header row and up to 6 body rows. */
export interface TableSlide extends BaseSlide {
  type: 'table';
  columns: string[];
  rows: string[][];
}

export type SlideNode =
  | StandardTextSlide
  | SplitColumnSlide
  | CodeExplainerSlide
  | CalloutCardSlide
  | StepGridSlide
  | CardRowSlide
  | TableSlide;

export interface PresentationAST {
  lessonTitle: string;
  /** One-line tagline under the title on the cover slide. */
  lessonSubtitle?: string;
  targetAudience: string;
  /** Theme id (lib/themes.ts) the deck was generated with. Preview and .pptx export both use it;
   * absent on decks made before this field existed, which then fall back to the course/global default. */
  themeId?: string;
  slides: SlideNode[];
}
