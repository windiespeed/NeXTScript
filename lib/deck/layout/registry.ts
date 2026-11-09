/**
 * Layout registry: one function per slide type, each returning positioned elements.
 * Adapters (HTML preview, pptx, Google Slides) consume `SlideLayout` and never repeat geometry.
 *
 * Only `concept` is implemented so far. The rest of the 14 types land in later steps of the
 * deck-builder plan; until then `layoutSlide` reports them as unsupported instead of guessing.
 */

import type { DeckContent, DeckSlide, DeckSlideType, SlideOf } from "../schema";
import { layoutConcept } from "./concept";
import type { SlideLayout } from "./types";

export type LayoutFn<T extends DeckSlideType> = (slide: SlideOf<T>) => SlideLayout;

type Registry = { [T in DeckSlideType]?: LayoutFn<T> };

export const LAYOUTS: Registry = {
  concept: layoutConcept,
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
  return fn(slide as never);
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
