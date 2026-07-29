export type SlideType = 'standard' | 'split-column' | 'code-explainer' | 'callout' | 'step-grid';

export interface BaseSlide {
  id: string;
  type: SlideType;
  title: string;
  subtitle?: string;
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

export type SlideNode =
  | StandardTextSlide
  | SplitColumnSlide
  | CodeExplainerSlide
  | CalloutCardSlide
  | StepGridSlide;

export interface PresentationAST {
  lessonTitle: string;
  targetAudience: string;
  slides: SlideNode[];
}
