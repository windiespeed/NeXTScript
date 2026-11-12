import { LIMITS } from "@/lib/deck/schema";
import type { DeckSlide, DeckSlideType } from "@/lib/deck/schema";

const L = LIMITS;
const notes = "Facilitation notes.";
const WORDS = "props state render component hook effect value array object string function return ".repeat(20);

/** Realistic-looking text of exactly `len` characters (word-wrapped like real prose). */
export const sized = (len: number) => WORDS.slice(0, len).trimEnd().padEnd(len, "s");
const many = (n: number, len: number) => Array.from({ length: n }, () => sized(len));
const code = (n: number, len: number) => Array.from({ length: n }, (_, i) => `const v${i} = ${"x".repeat(Math.max(0, len - 12))};`.slice(0, len));

/** Every field at its schema limit: the worst case each layout must handle. */
export const MAX_SLIDES: Record<DeckSlideType, DeckSlide> = {
  title: { id: "title", type: "title", notes, kicker: sized(L.title.kicker), title: sized(L.title.title), subtitle: sized(L.title.subtitle) },
  agenda: { id: "agenda", type: "agenda", notes, title: sized(L.slideTitle), items: Array.from({ length: L.agenda.items }, () => ({ label: sized(L.agenda.label), minutes: 180 })) },
  objectives: { id: "objectives", type: "objectives", notes, title: sized(L.slideTitle), objectives: many(L.objectives.items, L.objectives.text) },
  concept: { id: "concept", type: "concept", notes, title: sized(L.slideTitle), lead: sized(L.concept.lead), bullets: many(L.concept.bullets, L.concept.bullet) },
  code: { id: "code", type: "code", notes, title: sized(L.slideTitle), language: sized(L.code.language), lines: code(L.code.lines, L.code.lineChars), caption: sized(L.code.caption), pointOut: many(L.code.pointOut, L.code.point) },
  compare: { id: "compare", type: "compare", notes, title: sized(L.slideTitle), left: { heading: sized(L.compare.heading), points: many(L.compare.points, L.compare.point) }, right: { heading: sized(L.compare.heading), points: many(L.compare.points, L.compare.point) } },
  cards: { id: "cards", type: "cards", notes, title: sized(L.slideTitle), cards: Array.from({ length: L.cards.cards }, () => ({ tag: sized(L.cards.tag), heading: sized(L.cards.heading), body: sized(L.cards.body) })) },
  table: { id: "table", type: "table", notes, title: sized(L.slideTitle), columns: many(L.table.columns, 20), rows: Array.from({ length: L.table.rows }, () => many(L.table.columns, L.table.cell)) },
  steps: { id: "steps", type: "steps", notes, title: sized(L.slideTitle), steps: Array.from({ length: L.steps.steps }, () => ({ title: sized(L.steps.title), detail: sized(L.steps.detail) })) },
  section: { id: "section", type: "section", notes, kicker: sized(L.section.kicker), title: sized(L.section.title), subtitle: sized(L.section.subtitle) },
  callout: { id: "callout", type: "callout", notes, variant: "key-idea", heading: sized(L.callout.heading), body: sized(L.callout.body) },
  pitfalls: { id: "pitfalls", type: "pitfalls", notes, title: sized(L.slideTitle), pairs: Array.from({ length: L.pitfalls.pairs }, () => ({ wrong: sized(L.pitfalls.text), right: sized(L.pitfalls.text), why: sized(L.pitfalls.text) })) },
  lab: { id: "lab", type: "lab", notes, title: sized(L.slideTitle), minutes: 180, tasks: many(L.lab.tasks, L.lab.task), doneWhen: many(L.lab.doneWhen, L.lab.criterion) },
  "exit-ticket": { id: "exit-ticket", type: "exit-ticket", notes, title: sized(L.slideTitle), questions: many(L.exitTicket.questions, L.exitTicket.question), homework: sized(L.exitTicket.homework) },
  closing: { id: "closing", type: "closing", notes, title: sized(L.closing.title), takeaways: many(L.closing.takeaways, L.closing.takeaway), nextUp: sized(L.closing.nextUp) },
};

/** The smallest valid content for each type. */
export const MIN_SLIDES: Record<DeckSlideType, DeckSlide> = {
  title: { id: "title", type: "title", notes, title: "Day 1" },
  agenda: { id: "agenda", type: "agenda", notes, title: "Today", items: [{ label: "Warm-up" }, { label: "Lab" }] },
  objectives: { id: "objectives", type: "objectives", notes, title: "Goals", objectives: ["Write a function"] },
  concept: { id: "concept", type: "concept", notes, title: "Idea", bullets: ["One point"] },
  code: { id: "code", type: "code", notes, title: "Code", language: "js", lines: ["let a = 1;"], pointOut: ["let"] },
  compare: { id: "compare", type: "compare", notes, title: "A vs B", left: { heading: "A", points: ["a"] }, right: { heading: "B", points: ["b"] } },
  cards: { id: "cards", type: "cards", notes, title: "Cards", cards: [{ heading: "One", body: "1" }, { heading: "Two", body: "2" }] },
  table: { id: "table", type: "table", notes, title: "Table", columns: ["A", "B"], rows: [["1", "2"]] },
  steps: { id: "steps", type: "steps", notes, title: "Steps", steps: [{ title: "First", detail: "Do it" }, { title: "Second", detail: "Again" }] },
  section: { id: "section", type: "section", notes, title: "Part 2" },
  callout: { id: "callout", type: "callout", notes, variant: "tip", heading: "Save often." },
  pitfalls: { id: "pitfalls", type: "pitfalls", notes, title: "Watch out", pairs: [{ wrong: "x == y", right: "x === y" }] },
  lab: { id: "lab", type: "lab", notes, title: "Lab", tasks: ["Build it"], doneWhen: ["It runs"] },
  "exit-ticket": { id: "exit-ticket", type: "exit-ticket", notes, title: "Exit ticket", questions: ["What is a prop?"] },
  closing: { id: "closing", type: "closing", notes, title: "Thanks" },
};
