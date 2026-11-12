/**
 * Deck content schema — the contract between AI generation and rendering.
 *
 * The model (or an instructor) produces only content that matches `DeckSchema`. Layout code in
 * lib/deck/layout/* turns each slide into positioned elements, and adapters (HTML preview, pptx,
 * Google Slides) draw those elements. Nothing here knows about pixels or fonts.
 *
 * Every string and array carries a `.max()` limit sized to its layout, so content that can't fit
 * is rejected at validation time instead of overflowing on the slide. The limits live in `LIMITS`
 * so layouts and prompts can quote the same numbers.
 *
 * Constraints are kept to what JSON Schema can express (lengths, counts, enums) so the schema
 * converts for structured outputs (`messages.parse` + zodOutputFormat). The one exception is the
 * concept slide's tighter bullet limit when an aside is present: it's a refinement, so it's checked
 * when the response is parsed, and it's also spelled out in the field description for the model.
 *
 * This lives alongside the older 5-type `PresentationAST` (types/slideAst.ts), which the current
 * Notes-to-Slides path still uses unchanged.
 */

import { z } from "zod";

/** Character and count limits per slide type. Layout geometry in lib/deck/layout is tuned to these. */
export const LIMITS = {
  notes: 1500,
  slideTitle: 60,
  /** Small label above a content slide's title, and the footer line. */
  label: 40,
  footer: 70,
  /** One-sentence takeaway line along the bottom of a content slide. */
  takeaway: 120,
  deckTitle: 80,
  slidesPerDeck: 40,

  title: { title: 60, subtitle: 110, kicker: 40 },
  agenda: { items: 7, label: 48, minutes: 180 },
  objectives: { items: 5, text: 110 },
  concept: { lead: 160, bullets: 5, bullet: 130, asideLabel: 24, asideBody: 220, withAside: { bullets: 4, bullet: 100 } },
  code: { language: 20, lines: 14, lineChars: 68, caption: 100, pointOut: 4, point: 90, outputLines: 4 },
  compare: { heading: 30, points: 5, point: 90 },
  cards: { cards: 4, heading: 32, body: 120, tag: 16 },
  table: { columns: 4, minColumns: 2, rows: 5, cell: 60 },
  steps: { steps: 6, title: 32, detail: 100 },
  section: { title: 50, kicker: 40, subtitle: 110 },
  callout: { heading: 80, body: 240 },
  pitfalls: { pairs: 3, text: 80 },
  lab: { tasks: 6, task: 110, doneWhen: 3, criterion: 110, minutes: 180 },
  exitTicket: { questions: 3, question: 120, homework: 150 },
  closing: { title: 60, takeaways: 3, takeaway: 100, nextUp: 110 },
} as const;

const L = LIMITS;

const text = (max: number) => z.string().trim().min(1).max(max);

/** Fields every slide type shares. `notes` is required: every slide gets facilitation-style speaker notes. */
const base = {
  id: z.string().min(1).max(64),
  notes: text(L.notes).describe(
    "Facilitation-style speaker notes: what to say, what to ask, what to watch for. Required on every slide.",
  ),
  label: text(L.label)
    .optional()
    .describe('Small label above the title of content slides, naming the part and topic, e.g. "Part 1 · Main idea". Ignored on title, section, callout and closing slides.'),
  footer: text(L.footer)
    .optional()
    .describe('Footer line along the bottom, usually the current part, e.g. "Part 1 · Reading closely".'),
  takeaway: text(L.takeaway)
    .optional()
    .describe("One short sentence drawn in the accent color at the bottom of a content slide: the point to leave with. Ignored on title, section, callout and closing slides."),
};

const contentTitle = text(L.slideTitle);

// ── Slide types ─────────────────────────────────────────────────────────────

export const TitleSlideSchema = z.object({
  ...base,
  type: z.literal("title"),
  title: text(L.title.title),
  subtitle: text(L.title.subtitle).optional(),
  kicker: text(L.title.kicker).optional().describe('Small label above the title, e.g. "Week 3 · Day 2".'),
});

export const AgendaSlideSchema = z.object({
  ...base,
  type: z.literal("agenda"),
  title: contentTitle,
  items: z
    .array(
      z.object({
        label: text(L.agenda.label),
        minutes: z.number().int().min(1).max(L.agenda.minutes).optional(),
      }),
    )
    .min(2)
    .max(L.agenda.items)
    .describe("Run of show for the session, in order."),
});

export const ObjectivesSlideSchema = z.object({
  ...base,
  type: z.literal("objectives"),
  title: contentTitle,
  objectives: z.array(text(L.objectives.text)).min(1).max(L.objectives.items),
});

export const ConceptSlideSchema = z.object({
  ...base,
  type: z.literal("concept"),
  title: contentTitle,
  lead: text(L.concept.lead).optional().describe("One-sentence framing line shown under the title."),
  bullets: z
    .array(text(L.concept.bullet))
    .min(1)
    .max(L.concept.bullets)
    .describe(
      `With an aside, at most ${L.concept.withAside.bullets} bullets of ${L.concept.withAside.bullet} characters, since the column is narrower.`,
    ),
  aside: z
    .object({
      label: text(L.concept.asideLabel).describe('Short panel label, e.g. "Analogy" or "Why it matters".'),
      body: text(L.concept.asideBody),
    })
    .optional()
    .describe("Optional side panel for an analogy, definition, or real-world example."),
}).superRefine((slide, ctx) => {
  if (!slide.aside) return;
  const { bullets, bullet } = L.concept.withAside;
  if (slide.bullets.length > bullets) {
    ctx.addIssue({ code: "custom", path: ["bullets"], message: `At most ${bullets} bullets when the slide has an aside.` });
  }
  slide.bullets.forEach((b, i) => {
    if (b.length > bullet) {
      ctx.addIssue({ code: "custom", path: ["bullets", i], message: `At most ${bullet} characters per bullet when the slide has an aside.` });
    }
  });
});

/** Lines of code room the output panel's label and padding take. */
export const CODE_OUTPUT_OVERHEAD = 3;

export const CodeSlideSchema = z.object({
  ...base,
  type: z.literal("code"),
  title: contentTitle,
  language: text(L.code.language),
  lines: z
    .array(z.string().max(L.code.lineChars))
    .min(1)
    .max(L.code.lines)
    .describe(`Code or other exact text (commands, formulas), one array entry per line, at most ${L.code.lineChars} characters each.`),
  caption: text(L.code.caption).optional(),
  output: z
    .array(z.string().max(L.code.lineChars))
    .min(1)
    .max(L.code.outputLines)
    .optional()
    .describe(`What running the code prints or shows, one entry per line, drawn in a console panel under the code. With output, lines + output + ${3} must stay within ${L.code.lines}.`),
  pointOut: z
    .array(text(L.code.point))
    .min(1)
    .max(L.code.pointOut)
    .describe("What to point out in the code."),
}).superRefine((slide, ctx) => {
  // The console panel takes the room of its lines plus about three more (label and padding).
  if (slide.output && slide.lines.length + slide.output.length + CODE_OUTPUT_OVERHEAD > L.code.lines) {
    ctx.addIssue({
      code: "custom", path: ["lines"],
      message: `With output, at most ${L.code.lines - slide.output.length - CODE_OUTPUT_OVERHEAD} lines of code fit.`,
    });
  }
});

const compareSide = z.object({
  heading: text(L.compare.heading),
  points: z.array(text(L.compare.point)).min(1).max(L.compare.points),
});

export const CompareSlideSchema = z.object({
  ...base,
  type: z.literal("compare"),
  title: contentTitle,
  left: compareSide,
  right: compareSide,
});

export const CardsSlideSchema = z.object({
  ...base,
  type: z.literal("cards"),
  title: contentTitle,
  cards: z
    .array(z.object({
      tag: text(L.cards.tag).optional().describe('Small chip above the heading naming the card\'s role, e.g. "Structure".'),
      heading: text(L.cards.heading),
      body: text(L.cards.body),
    }))
    .min(2)
    .max(L.cards.cards),
});

export const TableSlideSchema = z.object({
  ...base,
  type: z.literal("table"),
  title: contentTitle,
  columns: z
    .array(z.string().trim().max(L.table.cell))
    .min(L.table.minColumns)
    .max(L.table.columns)
    .describe("Header row. The first cell may be empty when the first column holds row names."),
  rows: z
    .array(z.array(z.string().trim().max(L.table.cell)).min(L.table.minColumns).max(L.table.columns))
    .min(1)
    .max(L.table.rows)
    .describe("Body rows, each with one cell per column."),
}).superRefine((slide, ctx) => {
  slide.rows.forEach((row, i) => {
    if (row.length !== slide.columns.length) {
      ctx.addIssue({ code: "custom", path: ["rows", i], message: `Each row needs ${slide.columns.length} cells, one per column.` });
    }
  });
});

export const StepsSlideSchema = z.object({
  ...base,
  type: z.literal("steps"),
  title: contentTitle,
  steps: z
    .array(z.object({ title: text(L.steps.title), detail: text(L.steps.detail) }))
    .min(2)
    .max(L.steps.steps)
    .describe("Steps in order; numbering is added by the layout."),
});

export const SectionSlideSchema = z.object({
  ...base,
  type: z.literal("section"),
  title: text(L.section.title),
  kicker: text(L.section.kicker).optional().describe('e.g. "Part 2" or "After the break".'),
  subtitle: text(L.section.subtitle).optional(),
});

export const CALLOUT_VARIANTS = ["key-idea", "tip", "warning", "instructor-note"] as const;

export const CalloutSlideSchema = z.object({
  ...base,
  type: z.literal("callout"),
  variant: z.enum(CALLOUT_VARIANTS),
  heading: text(L.callout.heading),
  body: text(L.callout.body).optional(),
});

export const PitfallsSlideSchema = z.object({
  ...base,
  type: z.literal("pitfalls"),
  title: contentTitle,
  pairs: z
    .array(
      z.object({
        wrong: text(L.pitfalls.text),
        right: text(L.pitfalls.text),
        why: text(L.pitfalls.text).optional(),
      }),
    )
    .min(1)
    .max(L.pitfalls.pairs),
});

export const LabSlideSchema = z.object({
  ...base,
  type: z.literal("lab"),
  title: contentTitle,
  minutes: z.number().int().min(1).max(L.lab.minutes).optional(),
  tasks: z.array(text(L.lab.task)).min(1).max(L.lab.tasks),
  doneWhen: z
    .array(text(L.lab.criterion))
    .min(1)
    .max(L.lab.doneWhen)
    .describe("How students know they are done."),
});

export const ExitTicketSlideSchema = z.object({
  ...base,
  type: z.literal("exit-ticket"),
  title: contentTitle,
  questions: z.array(text(L.exitTicket.question)).min(1).max(L.exitTicket.questions),
  homework: text(L.exitTicket.homework).optional(),
});

export const ClosingSlideSchema = z.object({
  ...base,
  type: z.literal("closing"),
  title: text(L.closing.title),
  takeaways: z.array(text(L.closing.takeaway)).max(L.closing.takeaways).optional(),
  nextUp: text(L.closing.nextUp).optional(),
});

// ── Unions and deck ─────────────────────────────────────────────────────────

export const SlideSchema = z.discriminatedUnion("type", [
  TitleSlideSchema,
  AgendaSlideSchema,
  ObjectivesSlideSchema,
  ConceptSlideSchema,
  CodeSlideSchema,
  CompareSlideSchema,
  CardsSlideSchema,
  TableSlideSchema,
  StepsSlideSchema,
  SectionSlideSchema,
  CalloutSlideSchema,
  PitfallsSlideSchema,
  LabSlideSchema,
  ExitTicketSlideSchema,
  ClosingSlideSchema,
]);

export const DeckSchema = z.object({
  lessonTitle: text(L.deckTitle),
  slides: z.array(SlideSchema).min(1).max(L.slidesPerDeck),
});

export type DeckSlide = z.infer<typeof SlideSchema>;
export type DeckSlideType = DeckSlide["type"];
export type DeckContent = z.infer<typeof DeckSchema>;
export type SlideOf<T extends DeckSlideType> = Extract<DeckSlide, { type: T }>;

export type ConceptSlide = SlideOf<"concept">;

/** All slide types, in the order they typically appear in a session deck. */
export const DECK_SLIDE_TYPES = SlideSchema.options.map(o => o.shape.type.value) as DeckSlideType[];

/** Types drawn on a dark surface regardless of theme. */
export const DARK_SLIDE_TYPES: ReadonlySet<DeckSlideType> = new Set(["title", "section", "callout", "closing"]);
