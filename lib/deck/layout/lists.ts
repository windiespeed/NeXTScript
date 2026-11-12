/**
 * Row-based layouts under the standard header: agenda (run of show), objectives, exit ticket.
 */

import type { SlideOf } from "../schema";
import { GRID, bodyBottom, HEADER, SlideBuilder, split } from "./kit";
import type { SlideLayout } from "./types";

const x = GRID.marginX;
const W = GRID.contentW;

/** Agenda: one row per block, minutes on the left, label on the right, thin rules between. */
export function layoutAgenda(slide: SlideOf<"agenda">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes);
  const top = b.header(slide.title) + HEADER.bodyGap;
  const items = slide.items;
  const total = items.every(i => i.minutes) ? items.reduce((n, i) => n + (i.minutes ?? 0), 0) : null;
  const footerH = total ? 22 : 0;
  const rowH = Math.min(44, (bodyBottom() - footerH - top) / items.length);
  const timeW = 80;

  items.forEach((item, i) => {
    const y = top + i * rowH;
    if (i > 0) b.rect(`rule.${i}`, x, y, W, 1, "panel");
    if (item.minutes) {
      b.text({
        id: `minutes.${i}`, what: `Agenda time ${i + 1}`,
        paragraphs: [{ text: `${item.minutes} min`, bold: true }],
        x, y, w: timeW, h: rowH, maxSize: 15, minSize: 11, color: "accent.primary", valign: "middle",
      });
    }
    b.text({
      id: `item.${i}`, what: `Agenda item ${i + 1}`,
      paragraphs: [{ text: item.label }],
      x: x + timeW + 12, y, w: W - timeW - 12, h: rowH,
      maxSize: 18, minSize: 12, warnBelow: 15, color: "text.primary", valign: "middle",
    });
  });

  if (total) {
    b.text({
      id: "total", what: "Total time",
      paragraphs: [{ text: `${total} min total` }],
      x, y: bodyBottom() - footerH + 6, w: W, h: footerH - 6,
      maxSize: 11, minSize: 10, color: "text.muted", align: "right",
    });
  }
  return b.build();
}

/** Objectives: a numbered badge and the objective text on each row. */
export function layoutObjectives(slide: SlideOf<"objectives">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes);
  const top = b.header(slide.title) + HEADER.bodyGap;
  const n = slide.objectives.length;
  const gap = 12;
  const rowH = Math.min(64, split(bodyBottom() - top, n, gap));
  const badge = 30;

  slide.objectives.forEach((text, i) => {
    const y = top + i * (rowH + gap);
    b.rect(`badge.${i}`, x, y + 2, badge, badge, "accent.primary", badge / 2);
    b.elements.push({
      kind: "text", id: `badge.${i}.n`, x, y: y + 2, w: badge, h: badge,
      font: "heading", fontSize: 15, lineHeight: 1, paragraphGap: 0,
      color: "surface", align: "center", valign: "middle",
      paragraphs: [{ text: String(i + 1), bold: true }],
    });
    b.text({
      id: `objective.${i}`, what: `Objective ${i + 1}`,
      paragraphs: [{ text }],
      x: x + badge + 16, y, w: W - badge - 16, h: rowH,
      maxSize: 18, minSize: 12, warnBelow: 15, color: "text.primary",
    });
  });
  return b.build();
}

/** Exit ticket: numbered question cards, and a homework strip at the bottom if there is one. */
export function layoutExitTicket(slide: SlideOf<"exit-ticket">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes);
  const top = b.header(slide.title) + HEADER.bodyGap;
  const hwH = slide.homework ? 58 : 0;
  const hwGap = slide.homework ? 12 : 0;
  const n = slide.questions.length;
  const gap = 8;
  const cardH = Math.min(80, split(bodyBottom() - hwH - hwGap - top, n, gap));
  const pad = 8;
  const numW = 30;

  slide.questions.forEach((q, i) => {
    const y = top + i * (cardH + gap);
    b.rect(`question.${i}.panel`, x, y, W, cardH, "panel", 8);
    b.elements.push({
      kind: "text", id: `question.${i}.n`, x: x + pad, y: y + pad, w: numW, h: cardH - pad * 2,
      font: "heading", fontSize: 18, lineHeight: 1, paragraphGap: 0,
      color: "accent.primary", align: "center", valign: "middle",
      paragraphs: [{ text: String(i + 1), bold: true }],
    });
    b.text({
      id: `question.${i}`, what: `Question ${i + 1}`,
      paragraphs: [{ text: q }],
      x: x + pad + numW + 6, y: y + pad, w: W - pad * 2 - numW - 6, h: cardH - pad * 2,
      maxSize: 17, minSize: 11, warnBelow: 13, color: "text.primary", valign: "middle",
    });
  });

  if (slide.homework) {
    const y = bodyBottom() - hwH;
    b.rect("homework.stripe", x, y, 4, hwH, "accent.secondary");
    const lh = b.label("homework.label", "Homework", x + 16, y + 4, W - 16, "accent.secondary");
    b.text({
      id: "homework", what: "Homework",
      paragraphs: [{ text: slide.homework }],
      x: x + 16, y: y + 4 + lh + 4, w: W - 16, h: hwH - lh - 8,
      maxSize: 15, minSize: 11, warnBelow: 12, color: "text.secondary",
    });
  }
  return b.build();
}
