/**
 * Layout registry: one function per slide type, each returning positioned elements.
 * Adapters (HTML preview, pptx, Google Slides) consume `SlideLayout` and never repeat geometry.
 *
 * Every one of the 14 slide types has a layout. `UnsupportedSlideTypeError` and the `unsupported`
 * list stay as a guard for slide types added to the schema before their layout exists.
 */

import type { DeckContent, DeckSlide, DeckSlideType, SlideOf } from "../schema";
import { layoutCode } from "./code";
import { layoutConcept } from "./concept";
import { layoutAgenda, layoutExitTicket, layoutObjectives } from "./lists";
import { layoutCards, layoutCompare, layoutLab, layoutPitfalls, layoutSteps } from "./panels";
import { layoutCallout, layoutClosing, layoutSection, layoutTitle } from "./statement";
import { decorate } from "./decorations";
import type { SlideLayout } from "./types";

export type LayoutFn<T extends DeckSlideType> = (slide: SlideOf<T>) => SlideLayout;

type Registry = { [T in DeckSlideType]?: LayoutFn<T> };

export const LAYOUTS: Registry = {
  title: layoutTitle,
  agenda: layoutAgenda,
  objectives: layoutObjectives,
  concept: layoutConcept,
  code: layoutCode,
  compare: layoutCompare,
  cards: layoutCards,
  steps: layoutSteps,
  section: layoutSection,
  callout: layoutCallout,
  pitfalls: layoutPitfalls,
  lab: layoutLab,
  "exit-ticket": layoutExitTicket,
  closing: layoutClosing,
};

export function hasLayout(type: DeckSlideType): boolean {
  return LAYOUTS[type] !== undefined;
}

export class UnsupportedSlideTypeError extends Error {
  constructor(public readonly slideType: DeckSlideType) {
    super(`No layout registered for slide type "${slideType}" yet.`);
    this.name = "UnsupportedSlideTypeError";
  }
}

export function layoutSlide(slide: DeckSlide): SlideLayout {
  const fn = LAYOUTS[slide.type] as LayoutFn<typeof slide.type> | undefined;
  if (!fn) throw new UnsupportedSlideTypeError(slide.type);
  return decorate(fn(slide as never), slide);
}

/** Lays out every slide. Slides without a layout yet are returned in `unsupported` rather than thrown. */
export function layoutDeck(deck: DeckContent): { slides: SlideLayout[]; unsupported: DeckSlide[] } {
  const slides: SlideLayout[] = [];
  const unsupported: DeckSlide[] = [];
  for (const slide of deck.slides) {
    if (hasLayout(slide.type)) slides.push(layoutSlide(slide));
    else unsupported.push(slide);
  }
  return { slides, unsupported };
}
