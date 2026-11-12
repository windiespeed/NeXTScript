/**
 * Panel-based layouts under the standard header: compare, cards, steps, pitfalls, lab.
 */

import type { SlideOf } from "../schema";
import { asidePanel } from "./concept";
import { GRID, bodyBottom, HEADER, SlideBuilder, bullets, numbered, split } from "./kit";
import type { ColorToken, SlideLayout } from "./types";

const x0 = GRID.marginX;
const W = GRID.contentW;
const ACCENTS: ColorToken[] = ["accent.primary", "accent.secondary", "accent.tertiary"];
const PAD = 14;

/** Compare: two equal panels, each with a colored heading and bullets. */
export function layoutCompare(slide: SlideOf<"compare">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes);
  const top = b.header(slide.title) + HEADER.bodyGap;
  const colW = split(W, 2, GRID.gutter);
  const h = bodyBottom() - top;

  ([["left", slide.left, "accent.primary"], ["right", slide.right, "accent.secondary"]] as const).forEach(([side, col, accent], i) => {
    const x = x0 + i * (colW + GRID.gutter);
    b.rect(`${side}.panel`, x, top, colW, h, "panel", 10);
    b.rect(`${side}.bar`, x, top, colW, 4, accent);
    const head = b.text({
      id: `${side}.heading`, what: `${i === 0 ? "Left" : "Right"} heading`,
      paragraphs: [{ text: col.heading, bold: true }],
      x: x + PAD, y: top + PAD + 4, w: colW - PAD * 2, h: 44,
      font: "heading", maxSize: 16, minSize: 13, lineHeight: 1.15, color: accent, hug: true,
    });
    const by = top + PAD + 4 + head.h + 10;
    b.text({
      id: `${side}.body`, what: `${i === 0 ? "Left" : "Right"} column`,
      paragraphs: bullets(col.points),
      x: x + PAD, y: by, w: colW - PAD * 2, h: top + h - PAD - by,
      maxSize: 16, minSize: 11, warnBelow: 13, gapEm: 0.5, color: "text.secondary",
    });
  });
  return b.build();
}

/** Cards: 2–4 cards in one row, each with an accent strip, an optional tag chip, a heading, and a short body. */
export function layoutCards(slide: SlideOf<"cards">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes);
  const top = b.header(slide.title) + HEADER.bodyGap;
  const n = slide.cards.length;
  const gap = 16;
  const cardW = split(W, n, gap);
  const h = Math.min(220, bodyBottom() - top);

  slide.cards.forEach((card, i) => {
    const x = x0 + i * (cardW + gap);
    const accent = ACCENTS[i % ACCENTS.length];
    b.rect(`card.${i}.panel`, x, top, cardW, h, "panel", 10);
    b.rect(`card.${i}.bar`, x, top, cardW, 4, accent);
    let hy = top + PAD + 4;
    if (card.tag) {
      // A filled chip: accent background, the card color as text, sized to the tag.
      const chipW = Math.min(cardW - PAD * 2, Math.ceil(card.tag.length * 9 * 0.62 + 14));
      b.rect(`card.${i}.tag.chip`, x + PAD, hy, chipW, 16, accent, 3);
      b.elements.push({
        kind: "text", id: `card.${i}.tag`, x: x + PAD, y: hy, w: chipW, h: 16,
        font: "body", fontSize: 9, lineHeight: 1, paragraphGap: 0,
        color: "panel", align: "center", valign: "middle", uppercase: true, letterSpacing: 0.8,
        paragraphs: [{ text: card.tag, bold: true }],
      });
      hy += 16 + 8;
    }
    const head = b.text({
      id: `card.${i}.heading`, what: `Card ${i + 1} heading`,
      paragraphs: [{ text: card.heading, bold: true }],
      x: x + PAD, y: hy, w: cardW - PAD * 2, h: 48,
      font: "heading", maxSize: 17, minSize: 13, lineHeight: 1.15, color: "text.primary", hug: true,
    });
    const by = hy + head.h + 8;
    b.text({
      id: `card.${i}.body`, what: `Card ${i + 1} text`,
      paragraphs: [{ text: card.body }],
      x: x + PAD, y: by, w: cardW - PAD * 2, h: top + h - PAD - by,
      maxSize: 15, minSize: 11, warnBelow: 13, color: "text.secondary",
    });
  });
  return b.build();
}

/** Steps: numbered cards in a grid of up to three columns. */
export function layoutSteps(slide: SlideOf<"steps">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes);
  const top = b.header(slide.title) + HEADER.bodyGap;
  const n = slide.steps.length;
  const cols = n === 4 ? 2 : Math.min(3, n);
  const rows = Math.ceil(n / cols);
  const gap = 14;
  const cardW = split(W, cols, gap);
  const cardH = Math.min(200, split(bodyBottom() - top, rows, gap));
  const badge = 26;

  slide.steps.forEach((step, i) => {
    const x = x0 + (i % cols) * (cardW + gap);
    const y = top + Math.floor(i / cols) * (cardH + gap);
    b.rect(`step.${i}.panel`, x, y, cardW, cardH, "panel", 10);
    b.rect(`step.${i}.badge`, x + PAD, y + PAD, badge, badge, "accent.primary", badge / 2);
    b.elements.push({
      kind: "text", id: `step.${i}.n`, x: x + PAD, y: y + PAD, w: badge, h: badge,
      font: "heading", fontSize: 13, lineHeight: 1, paragraphGap: 0,
      color: "surface", align: "center", valign: "middle",
      paragraphs: [{ text: String(i + 1), bold: true }],
    });
    const tx = x + PAD + badge + 10;
    const tw = cardW - PAD * 2 - badge - 10;
    const title = b.text({
      id: `step.${i}.title`, what: `Step ${i + 1} title`,
      paragraphs: [{ text: step.title, bold: true }],
      x: tx, y: y + PAD + 3, w: tw, h: 40,
      font: "heading", maxSize: 16, minSize: 12, lineHeight: 1.15, color: "text.primary", hug: true,
    });
    const dy = y + PAD + Math.max(badge, title.h + 3) + 8;
    b.text({
      id: `step.${i}.detail`, what: `Step ${i + 1} text`,
      paragraphs: [{ text: step.detail }],
      x: x + PAD, y: dy, w: cardW - PAD * 2, h: y + cardH - PAD - dy,
      maxSize: 14, minSize: 10, warnBelow: 12, color: "text.secondary",
    });
  });
  return b.build();
}

/**
 * Pitfalls: one row per mistake, in three columns: "Instead of", "Do this", and "Why".
 * Without any "why" text, the two remaining columns share the width.
 */
export function layoutPitfalls(slide: SlideOf<"pitfalls">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes);
  let top = b.header(slide.title) + HEADER.bodyGap;
  const hasWhy = slide.pairs.some(p => p.why);
  const cols = hasWhy ? 3 : 2;
  const gap = 14;
  const colW = split(W, cols, gap);
  const colX = (c: number) => x0 + c * (colW + gap);
  const heads: [string, string, ColorToken][] = [
    ["wrong", "Instead of", "accent.secondary"],
    ["right", "Do this", "accent.primary"],
    ["why", "Why", "accent.tertiary"],
  ];
  heads.slice(0, cols).forEach(([id, label, color], c) => b.label(`${id}.label`, label, colX(c), top, colW, color));
  top += 20;

  const n = slide.pairs.length;
  const rowGap = 10;
  const rowH = Math.min(110, split(bodyBottom() - top, n, rowGap));
  const pad = 10;

  slide.pairs.forEach((pair, i) => {
    const y = top + i * (rowH + rowGap);
    const cells: [string, string | undefined, ColorToken, ColorToken, string][] = [
      ["wrong", pair.wrong, "accent.secondary", "text.secondary", `Pitfall ${i + 1}`],
      ["right", pair.right, "accent.primary", "text.primary", `Fix ${i + 1}`],
      ["why", pair.why, "accent.tertiary", "text.secondary", `Reason ${i + 1}`],
    ];
    cells.slice(0, cols).forEach(([id, text, accent, color, what], c) => {
      const x = colX(c);
      b.rect(`pair.${i}.${id}.panel`, x, y, colW, rowH, "panel", 8);
      b.rect(`pair.${i}.${id}.bar`, x, y, 3, rowH, accent);
      if (!text) return;
      b.text({
        id: `pair.${i}.${id}`, what,
        paragraphs: [{ text, italic: id === "why" }],
        x: x + pad + 3, y: y + pad, w: colW - pad * 2 - 3, h: rowH - pad * 2,
        maxSize: 15, minSize: 10, warnBelow: 12, color,
      });
    });
  });
  return b.build();
}

/** Lab: numbered tasks on the left, a "Done when" panel on the right, time in the corner. */
export function layoutLab(slide: SlideOf<"lab">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes);
  const timeW = 90;
  const titleW = slide.minutes ? W - timeW - 12 : W;
  const top = b.header(slide.title, titleW) + HEADER.bodyGap;
  if (slide.minutes) {
    b.elements.push({
      kind: "text", id: "minutes", x: x0 + W - timeW, y: GRID.top + 14, w: timeW, h: 24,
      font: "heading", fontSize: 16, lineHeight: 1.2, paragraphGap: 0,
      color: "accent.primary", align: "right", valign: "top",
      paragraphs: [{ text: `${slide.minutes} min`, bold: true }],
    });
  }
  const panelW = 230;
  const gap = 24;
  const tasksW = W - panelW - gap;
  const h = bodyBottom() - top;

  b.label("tasks.label", "Tasks", x0, top, tasksW);
  b.text({
    id: "tasks", what: "Task list",
    paragraphs: numbered(slide.tasks),
    x: x0, y: top + 20, w: tasksW, h: h - 20,
    maxSize: 17, minSize: 11, warnBelow: 14, gapEm: 0.55, color: "text.primary",
  });
  asidePanel(b, "done", "Done-when list", "Done when", bullets(slide.doneWhen), x0 + tasksW + gap, top, panelW, h, "accent.secondary");
  return b.build();
}

/**
 * Table: a header row in the accent color over a panel, then body rows on alternating fills.
 * Column widths follow how much text each column holds; the first column is bold.
 */
export function layoutTable(slide: SlideOf<"table">): SlideLayout {
  const b = new SlideBuilder(slide.id, slide.notes);
  const top = b.header(slide.title) + HEADER.bodyGap;
  const cols = slide.columns.length;
  const rows = slide.rows.map(r => Array.from({ length: cols }, (_, c) => r[c] ?? ""));
  const pad = 6;

  // Width by content: the longest text in each column, with every column at least a share.
  const weight = slide.columns.map((h, c) => Math.max(h.length, ...rows.map(r => r[c].length), 8));
  const total = weight.reduce((a, n) => a + n, 0);
  const minW = W / cols / 2;
  const raw = weight.map(n => Math.max(minW, (n / total) * W));
  const scale = W / raw.reduce((a, n) => a + n, 0);
  const colW = raw.map(n => n * scale);
  const colX = colW.map((_, c) => x0 + colW.slice(0, c).reduce((a, n) => a + n, 0));

  const headH = 26;
  const availH = bodyBottom() - top - headH;
  // Every row gets the height its tallest cell needs at the preferred size, then all rows share
  // what's left if that's too much.
  const cellH = (text: string, c: number, size: number) =>
    b.measure({ paragraphs: [{ text }], w: colW[c] - pad * 2, h: 200, maxSize: size, minSize: size, lineHeight: 1.25 });
  const wanted = rows.map(r => Math.max(...r.map((t, c) => cellH(t || " ", c, 14))) + pad * 2);
  const sum = wanted.reduce((a, n) => a + n, 0);
  const rowH = sum <= availH ? wanted : wanted.map(h => (h / sum) * availH);

  b.rect("table.head", x0, top, W, headH, "panel", 0);
  b.rect("table.head.bar", x0, top + headH - 2, W, 2, "accent.primary");
  slide.columns.forEach((h, c) => {
    b.text({
      id: `table.h.${c}`, what: `Column ${c + 1} heading`,
      paragraphs: [{ text: h, bold: true }],
      x: colX[c] + pad, y: top + 5, w: colW[c] - pad * 2, h: headH - 8,
      maxSize: 12, minSize: 9, color: "accent.primary", valign: "middle",
    });
  });

  let y = top + headH;
  rows.forEach((row, r) => {
    const h = rowH[r];
    if (r % 2 === 1) b.rect(`table.row.${r}`, x0, y, W, h, "panel", 0);
    row.forEach((cell, c) => {
      if (!cell) return;
      b.text({
        id: `table.c.${r}.${c}`, what: `Row ${r + 1}, column ${c + 1}`,
        paragraphs: [{ text: cell, bold: c === 0 }],
        x: colX[c] + pad, y: y + pad, w: colW[c] - pad * 2, h: h - pad * 2,
        maxSize: 14, minSize: 9, warnBelow: 11, lineHeight: 1.25,
        color: c === 0 ? "text.primary" : "text.secondary",
      });
    });
    y += h;
  });
  return b.build();
}
