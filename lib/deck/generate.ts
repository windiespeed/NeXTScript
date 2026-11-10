/**
 * AI generation for the new deck format: one lesson per call, structured outputs against
 * DeckSchema, with one repair turn if the response breaks a limit.
 *
 * The schema goes out as structured-output JSON Schema (lib/deck/wireSchema.ts). Limits the
 * grammar can't enforce (string lengths, item counts) are spelled out in the field descriptions
 * and validated here against DeckSchema after the response arrives. A response that fails validation gets one follow-up
 * turn listing the problems; the model fixes only those.
 */

import Anthropic from "@anthropic-ai/sdk";
import { DeckSchema, LIMITS } from "./schema";
import type { DeckContent } from "./schema";
import { toStructuredOutputSchema } from "./wireSchema";
import { DECK_MODELS, DEFAULT_DECK_MODEL } from "./models";
import type { DeckModelId } from "./models";

export { DECK_MODELS, DEFAULT_DECK_MODEL, isDeckModelId } from "./models";
export type { DeckModelId } from "./models";

export const DECK_SYSTEM_PROMPT = `You write slide decks for NeXTStack, Mississippi Coding Academies' full-stack developer program. Students are adults learning to code; instructors teach live, in person.

You produce content only, as JSON matching the schema. Layout code draws the slides, so never add formatting characters (no bullet symbols, no markdown, no numbering in list items). Every field limit in the schema is a hard limit set by the slide layout: write to fit it rather than trimming at the end.

Slide types and when to use them:
- title: opens the deck. kicker is a short label like "Week 6 · Day 2".
- agenda: the run of show, with minutes per block when the session timing is known.
- objectives: what students can do by the end, as plain "can do" statements.
- section: a divider between major parts of the session.
- concept: the workhorse for explaining one idea. A lead line frames it; bullets carry it. Use the aside for an analogy, definition, or real-world example (with an aside, use at most ${LIMITS.concept.withAside.bullets} bullets of ${LIMITS.concept.withAside.bullet} characters).
- code: a short, complete snippet, one array entry per line, with what to point out. Prefer several short code slides to one dense one.
- compare: two things side by side.
- cards: 2-4 parallel ideas of equal weight.
- steps: an ordered procedure.
- callout: one sentence worth pausing on (key idea, tip, warning, or instructor note).
- pitfalls: common mistakes, each with the fix and why.
- lab: hands-on tasks and how students know they're done.
- exit-ticket: 1-3 quick check questions, plus homework if any.
- closing: takeaways and what's next.

Session shape, unless the notes say otherwise: 3 hours, with a 15-minute warm-up, two 35-minute concept blocks around a break, a 50-minute lab, and a 10-minute exit ticket. A typical session deck runs 14-22 slides: title, agenda, objectives, then concept blocks (mostly concept and code slides, with the occasional compare, cards, steps, callout or pitfalls), a lab, the exit ticket, and a closing.

Speaker notes on every slide are for the instructor, written facilitation-style: what to say in their own words, a question to ask the room, what to demo, and what to watch for. Two to five sentences.

Stay accurate. Use current, idiomatic code. If the notes are thin, teach the topic well rather than padding.`;

export interface GenerateDeckInput {
  notes: string;
  lessonTitle?: string;
  audience?: string;
  /** Free-text extra context: course name, week, what came before. */
  context?: string;
  model?: DeckModelId;
}

export interface GenerateDeckResult {
  deck: DeckContent;
  model: DeckModelId;
  /** 1 when the first response was valid, 2 when it needed the repair turn. */
  attempts: number;
  usage: { input: number; output: number };
}

export class DeckGenerationError extends Error {
  constructor(message: string, readonly reason: "refusal" | "max_tokens" | "invalid" | "empty") {
    super(message);
    this.name = "DeckGenerationError";
  }
}

export function buildUserMessage(input: GenerateDeckInput): string {
  const parts = [
    input.lessonTitle ? `Lesson: ${input.lessonTitle}` : null,
    input.audience ? `Audience: ${input.audience}` : null,
    input.context ? `Context:\n${input.context}` : null,
    `Instructor notes:\n<notes>\n${input.notes.trim()}\n</notes>`,
    "Write the deck for this lesson.",
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** Turns zod issues into a short list the model can act on. */
export function describeIssues(issues: { path: PropertyKey[]; message: string }[], deck: unknown): string {
  return issues
    .slice(0, 25)
    .map(i => {
      const path = i.path.map(String).join(".");
      // Name the slide by id so the model doesn't have to count.
      const idx = i.path[0] === "slides" ? Number(i.path[1]) : NaN;
      const slides = (deck as { slides?: { id?: string; type?: string }[] })?.slides;
      const slide = Number.isInteger(idx) ? slides?.[idx] : undefined;
      const where = slide ? `slide "${slide.id}" (${slide.type}), ${i.path.slice(2).map(String).join(".")}` : path || "deck";
      return `- ${where}: ${i.message}`;
    })
    .join("\n");
}

function textOf(message: Anthropic.Message): string {
  return message.content.map(b => (b.type === "text" ? b.text : "")).join("");
}

export async function generateDeck(apiKey: string, input: GenerateDeckInput, client = new Anthropic({ apiKey })): Promise<GenerateDeckResult> {
  if (!input.notes.trim()) throw new DeckGenerationError("Add some notes first.", "empty");
  const model = input.model ?? DEFAULT_DECK_MODEL;
  const effort = DECK_MODELS.find(m => m.id === model)!.effort;
  const wireFormat = { type: "json_schema" as const, schema: toStructuredOutputSchema(DeckSchema) };

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildUserMessage(input) }];
  const usage = { input: 0, output: 0 };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const message = await client.messages
      .stream({
        model,
        max_tokens: 64000,
        system: DECK_SYSTEM_PROMPT,
        output_config: { format: wireFormat, effort },
        messages,
      })
      .finalMessage();
    usage.input += message.usage.input_tokens;
    usage.output += message.usage.output_tokens;

    if (message.stop_reason === "refusal") {
      throw new DeckGenerationError("The model declined to write this deck. Try rewording the notes.", "refusal");
    }
    if (message.stop_reason === "max_tokens") {
      throw new DeckGenerationError("The deck was too long to finish. Try splitting the notes into two lessons.", "max_tokens");
    }

    const raw = textOf(message);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      json = undefined;
    }
    const result = json === undefined ? null : DeckSchema.safeParse(json);
    if (result?.success) return { deck: result.data, model, attempts: attempt, usage };

    if (attempt === 2) {
      throw new DeckGenerationError("The deck still broke the slide limits after a retry. Try again or shorten the notes.", "invalid");
    }
    const problems = result ? describeIssues(result.error.issues, json) : "- The response wasn't valid JSON.";
    messages.push(
      { role: "assistant", content: message.content.filter(b => b.type === "text") },
      {
        role: "user",
        content: `Some fields break the slide limits:\n${problems}\n\nReturn the whole deck again with only these fixed. Shorten or split content; don't drop slides.`,
      },
    );
  }
  // Unreachable: the loop returns or throws.
  throw new DeckGenerationError("Generation failed.", "invalid");
}
