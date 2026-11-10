/**
 * Code slide: a dark code panel on the left, "What to point out" on the right, optional caption
 * under the code. The panel is sized to the longest line (within limits), and the code is never
 * wrapped: a line that can't fit is reported as overflow.
 */

import type { SlideOf } from "../schema";
import { fitCodeFont } from "./fit";
import { GRID, SlideBuilder, bullets } from "./kit";
import type { SlideLayout } from "./types";

export const CODE = {
  pad: 14,
  minPanelW: 300,
  maxPanelW: 440,
  gap: 22,
  preferredSize: 13,
  maxSize: 14,
  minSize: 9,
  warnBelow: 11,
  lineHeight: 1.25,
  labelSize: 9,
  captionH: 34,
  bodyGap: 12,
} as const;

export function layoutCode(slide: SlideOf<"code">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes);
  const top = b.header(slide.title) + CODE.bodyGap;
  const x = GRID.marginX;
  const C = CODE;

  const longest = slide.lines.reduce((m, l) => Math.max(m, l.length), 0);
  const wanted = Math.ceil(longest * 0.6 * C.preferredSize) + C.pad * 2;
  const panelW = Math.max(C.minPanelW, Math.min(C.maxPanelW, wanted));
  const captionH = slide.caption ? C.captionH : 0;
  const panelH = GRID.bodyBottom - top - captionH;

  b.rect("code.panel", x, top, panelW, panelH, "code.bg", 8);
  const labelH = b.label("code.label", slide.language, x + C.pad, top + 8, panelW - C.pad * 2, "accent.primary", C.labelSize);
  const codeY = top + 8 + labelH + 6;
  const codeW = panelW - C.pad * 2;
  const codeH = top + panelH - 10 - codeY;

  const fit = fitCodeFont(slide.lines, { width: codeW, height: codeH, lineHeight: C.lineHeight, maxSize: C.maxSize, minSize: C.minSize, step: 0.5 });
  // fitCodeFont reports any shrink; only shrinking below warnBelow is worth a badge.
  const severity = fit.severity === "shrunk" && fit.fontSize >= C.warnBelow ? undefined : fit.severity;
  b.elements.push({
    kind: "text", id: "code", x: x + C.pad, y: codeY, w: codeW, h: codeH,
    font: "code", fontSize: fit.fontSize, lineHeight: C.lineHeight, paragraphGap: 0,
    color: "code.text", align: "left", valign: "top",
    paragraphs: [{ text: slide.lines.join("\n") }],
  });
  b.warn("code", { ...fit, severity }, "Code");

  if (slide.caption) {
    b.text({
      id: "caption", what: "Caption",
      paragraphs: [{ text: slide.caption, italic: true }],
      x, y: top + panelH + 8, w: panelW, h: captionH - 8,
      maxSize: 11, minSize: 10, warnBelow: 10, color: "text.muted",
    });
  }

  const rx = x + panelW + C.gap;
  const rw = GRID.contentW - panelW - C.gap;
  const lh = b.label("pointOut.label", "Point out", rx, top, rw);
  b.text({
    id: "pointOut", what: "Point-out list",
    paragraphs: bullets(slide.pointOut),
    x: rx, y: top + lh + 10, w: rw, h: GRID.bodyBottom - top - lh - 10,
    maxSize: 15, minSize: 10, warnBelow: 12, gapEm: 0.6, color: "text.secondary",
  });
  return b.build();
}
