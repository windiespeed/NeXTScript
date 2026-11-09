import { v4 as uuidv4 } from "uuid";
import { resolveSections } from "@/lib/sections";
import { isSlideAnchor, type SectionDef } from "@/types/section";
import type { PresentationAST, SlideNode } from "@/types/slideAst";

/**
 * Locked slide anchors for the hybrid Notes to Slides model.
 *
 * The course configuration supplies the deck's skeleton: an ordered list of mandatory section
 * labels, each of which must appear as a primary slide heading. Only sections switched on as
 * slide headings count (SectionDef.slideAnchor; doc-only sections like the rubric default off). The instructor's freeform notes
 * supply the content that gets distributed under those anchors. Anchors come from the course's
 * active Sections (CourseSettings.sections, resolved through lib/sections.ts), so there is one
 * place to configure them and the lesson docs and slide decks stay aligned.
 *
 * Everything here is pure (no Firestore, no React), so the ingest route, the export route and
 * the browser all run the exact same anchor logic.
 */

export interface SlideAnchor {
  /** The SectionDef id this anchor comes from — stamped onto the matching slide as `anchorId`. */
  id: string;
  /** Exact heading the anchored slide must carry. */
  label: string;
}

type SectionSource = { settings?: { sectionLabels?: Record<string, string>; sections?: SectionDef[] } } | null | undefined;

/** Ordered, de-duplicated anchors for a course (falling back to the user's own section defaults). */
export function resolveSlideAnchors(course: SectionSource, userSettings?: { sectionLabels?: Record<string, string>; sections?: SectionDef[] } | null): SlideAnchor[] {
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();
  const anchors: SlideAnchor[] = [];
  for (const section of resolveSections({ course, userSettings })) {
    const label = section.label?.trim();
    if (!label || !isSlideAnchor(section) || seenIds.has(section.id) || seenLabels.has(normalizeHeading(label))) continue;
    seenIds.add(section.id);
    seenLabels.add(normalizeHeading(label));
    anchors.push({ id: section.id, label });
  }
  return anchors;
}

/** Case/punctuation-insensitive form of a heading, used only for matching. */
export function normalizeHeading(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export interface AnchorReport {
  /** Anchors the model skipped — a placeholder slide was inserted for each. */
  placeholders: string[];
  /** Anchors whose slide heading had to be rewritten to the exact course label. */
  retitled: string[];
  /** True when slides had to be moved to put the anchors back in course order. */
  reordered: boolean;
}

export const PLACEHOLDER_TEXT = "Add content for this section — the notes didn't cover it.";

function placeholderSlide(anchor: SlideAnchor): SlideNode {
  return { id: uuidv4(), type: "standard", anchorId: anchor.id, title: anchor.label, paragraphs: [PLACEHOLDER_TEXT] };
}

/** "Vocabulary: Key Terms" under anchor "Vocabulary" → "Key Terms", so the detail isn't lost when the heading is locked. */
function leftoverDetail(originalTitle: string, label: string): string | undefined {
  const original = originalTitle.trim();
  if (normalizeHeading(original) === normalizeHeading(label)) return undefined;
  if (original.toLowerCase().startsWith(label.toLowerCase())) {
    const rest = original.slice(label.length).replace(/^[\s:–—\-|·]+/, "").trim();
    return rest || undefined;
  }
  return original;
}

/**
 * Forces a deck onto the course skeleton:
 * - each anchor is matched to one slide (by `anchorId` first, then exact heading, then a heading
 *   that starts with or contains the label);
 * - the matched slide's title is set to the exact anchor label (the model's own wording moves to
 *   the subtitle when there isn't one already);
 * - anchors are put back in course order, each followed by the supporting slides that came
 *   after it in the model's output; slides before the first anchor stay at the front;
 * - an anchor nothing matched gets a placeholder slide, so the skeleton is always complete;
 * - stray `anchorId`s (unknown or duplicate) are removed.
 *
 * Running it on a deck that already conforms changes nothing, so the export route can safely
 * re-apply it to a client-edited deck.
 */
export function applySlideAnchors(ast: PresentationAST, anchors: SlideAnchor[]): { ast: PresentationAST; report: AnchorReport } {
  const report: AnchorReport = { placeholders: [], retitled: [], reordered: false };
  if (anchors.length === 0) {
    const slides = ast.slides.map(stripAnchor);
    return { ast: { ...ast, slides }, report };
  }

  const anchorById = new Map(anchors.map(a => [a.id, a]));
  const claimedBy = new Map<number, string>(); // slide index → anchor id
  const claimed = new Set<string>();

  // Pass 1: trust an explicit, valid, first-seen anchorId.
  ast.slides.forEach((slide, i) => {
    if (slide.anchorId && anchorById.has(slide.anchorId) && !claimed.has(slide.anchorId)) {
      claimedBy.set(i, slide.anchorId);
      claimed.add(slide.anchorId);
    }
  });

  // Pass 2/3: match remaining anchors by heading — exact first (for every anchor), then loose.
  const tryMatch = (test: (title: string, label: string) => boolean) => {
    for (const anchor of anchors) {
      if (claimed.has(anchor.id)) continue;
      const label = normalizeHeading(anchor.label);
      const idx = ast.slides.findIndex((s, i) => !claimedBy.has(i) && test(normalizeHeading(s.title ?? ""), label));
      if (idx !== -1) {
        claimedBy.set(idx, anchor.id);
        claimed.add(anchor.id);
      }
    }
  };
  tryMatch((title, label) => title === label);
  tryMatch((title, label) => label.length > 0 && (title.startsWith(label + " ") || ` ${title} `.includes(` ${label} `)));

  // Group: prelude (before any anchor) + each anchor's own slide and its supporting slides.
  const prelude: SlideNode[] = [];
  const groups = new Map<string, { anchorSlide: SlideNode; supporting: SlideNode[] }>();
  let current: string | null = null;
  const anchorOrderSeen: string[] = [];
  ast.slides.forEach((slide, i) => {
    const anchorId = claimedBy.get(i);
    if (anchorId) {
      const anchor = anchorById.get(anchorId)!;
      const exact = slide.title === anchor.label;
      if (!exact) report.retitled.push(anchor.label);
      const detail = exact ? undefined : leftoverDetail(slide.title ?? "", anchor.label);
      const anchorSlide: SlideNode = {
        ...slide,
        anchorId,
        title: anchor.label,
        ...(detail && !slide.subtitle ? { subtitle: detail } : {}),
      };
      groups.set(anchorId, { anchorSlide, supporting: [] });
      anchorOrderSeen.push(anchorId);
      current = anchorId;
      return;
    }
    const plain = stripAnchor(slide);
    if (current) groups.get(current)!.supporting.push(plain);
    else prelude.push(plain);
  });

  const expectedOrder = anchors.filter(a => groups.has(a.id)).map(a => a.id);
  report.reordered = expectedOrder.some((id, i) => anchorOrderSeen[i] !== id);

  const slides: SlideNode[] = [...prelude];
  for (const anchor of anchors) {
    const group = groups.get(anchor.id);
    if (group) {
      slides.push(group.anchorSlide, ...group.supporting);
    } else {
      report.placeholders.push(anchor.label);
      slides.push(placeholderSlide(anchor));
    }
  }

  return { ast: { ...ast, slides }, report };
}

function stripAnchor(slide: SlideNode): SlideNode {
  if (slide.anchorId === undefined) return slide;
  const rest = { ...slide };
  delete rest.anchorId;
  return rest;
}

/** True if the anchored slides at `a` and `b` can't swap without breaking anchor order. */
export function wouldBreakAnchorOrder(slides: SlideNode[], index: number, target: number): boolean {
  return !!slides[index]?.anchorId && !!slides[target]?.anchorId;
}

/** Short human summary of what applySlideAnchors had to fix, for the UI. Empty when nothing. */
export function describeAnchorReport(report: AnchorReport): string[] {
  const lines: string[] = [];
  if (report.placeholders.length > 0) {
    lines.push(`Added placeholder slides for sections the notes didn't cover: ${report.placeholders.join(", ")}.`);
  }
  if (report.reordered) lines.push("Moved sections back into the course's order.");
  return lines;
}
