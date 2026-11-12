/**
 * AI generation for the new deck format: one lesson per call, JSON against DeckSchema, with one
 * repair turn if the response breaks a limit.
 *
 * The schema (lib/deck/wireSchema.ts) goes in the system prompt, not in structured outputs: the
 * API compiles a structured-output schema into a grammar, and a deck's 14 slide types make that
 * grammar too large ("The compiled grammar is too large", 400, seen live on Nov 12, 2026, even
 * with every field required). Limits (string lengths, item counts, the slide type set) are spelled
 * out in the schema's descriptions and checked here against DeckSchema after the response
 * arrives. A response that fails validation gets one follow-up turn listing the problems; the
 * model fixes only those.
 */

import Anthropic from "@anthropic-ai/sdk";
import { DeckSchema, LIMITS } from "./schema";
import type { DeckContent } from "./schema";
import { toStructuredOutputSchema } from "./wireSchema";
import { DEFAULT_MODEL, getAiModel, type ClaudeModelId } from "@/lib/aiModels";
import { describeProgram, type ProgramContext } from "@/lib/programContext";
import { STUDENT_LEVEL_GUIDANCE, type StudentLevel } from "@/lib/studentLevel";


export const DECK_SYSTEM_PROMPT = `You write slide decks for live, in-person lessons. The course can be in any subject (English, math, science, history, health care, business, the arts, a trade, computing, or anything else) and for any student level. Take the subject, audience and level from the course details and notes you're given, and use that field's own vocabulary, examples and activities. Never assume the course is about technology.

You produce content only, as JSON matching the schema. Layout code draws the slides, so never add formatting characters (no bullet symbols, no markdown, no numbering in list items). Every field limit in the schema is a hard limit set by the slide layout: write to fit it rather than trimming at the end.

Slide types and when to use them:
- title: opens the deck. kicker is a short label like "Week 6 · Day 2".
- agenda: the run of show, with minutes per block when the session timing is known.
- objectives: what students can do by the end, as plain "can do" statements.
- section: a divider between major parts of the session.
- concept: the workhorse for explaining one idea. A lead line frames it; bullets carry it. Use the aside for an analogy, definition, or real-world example (with an aside, use at most ${LIMITS.concept.withAside.bullets} bullets of ${LIMITS.concept.withAside.bullet} characters).
- code: only when the lesson's subject involves code, commands, formulas written as code, or similar exact text that must be shown line by line. One array entry per line, with what to point out. Prefer several short code slides to one dense one. Most subjects never need this type.
- compare: two things side by side.
- cards: 2-4 parallel ideas of equal weight.
- steps: an ordered procedure.
- callout: one sentence worth pausing on (key idea, tip, warning, or instructor note).
- pitfalls: common mistakes, each with the fix and why.
- lab: the hands-on or practice activity (an exercise, discussion, writing task, problem set, project or skills practice), with tasks and how students know they're done.
- exit-ticket: 1-3 quick check questions, plus homework if any.
- closing: takeaways and what's next.

Session shape: follow the notes and course details for the session's length and activities. A typical session deck runs 12-22 slides: title, agenda, objectives, then concept blocks (mostly concept slides, with compare, cards, steps, callout or pitfalls where they fit), a practice activity, the exit ticket, and a closing. Leave out any part the lesson doesn't need.

Labels and footers: when the session has parts (sections), give every slide after the first section a label naming the part and the slide's topic ("Part 1 · Main idea") and a footer naming the current part ("Part 1 · Reading closely"), kept identical across a part. The title slide's footer can say what students leave with. Skip both when the session has no parts. Templates decide whether and how they're drawn.

Speaker notes on every slide are for the instructor, written facilitation-style: what to say in their own words, a question to ask the room, what to model or demonstrate, and what to watch for. Two to five sentences.

Stay accurate and current for the subject. Match the vocabulary and depth to the student level. If the notes are thin, teach the topic well rather than padding.`;

export interface GenerateDeckInput {
  notes: string;
  lessonTitle?: string;
  audience?: string;
  /** The course's Industry and Subject Area (lib/programContext.ts). */
  program?: Partial<ProgramContext>;
  /** Resolved to the shared level guidance, as every other generator does. */
  studentLevel?: StudentLevel;
  /** Free-text extra context: course name, week, what came before. */
  context?: string;
  model?: ClaudeModelId;
}

export interface GenerateDeckResult {
  deck: DeckContent;
  model: ClaudeModelId;
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
    describeProgram(input.program) ? `Program: ${describeProgram(input.program)}` : null,
    input.audience ? `Audience: ${input.audience}` : null,
    input.studentLevel ? `Student level: ${input.studentLevel}. ${STUDENT_LEVEL_GUIDANCE[input.studentLevel]}` : null,
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

let systemPrompt: string | undefined;

/** The system prompt plus the deck's JSON Schema, which tells the model the exact output shape. */
export function deckSystemPrompt(): string {
  systemPrompt ??= `${DECK_SYSTEM_PROMPT}

Output format: reply with a single JSON object and nothing else (no prose, no markdown code fence). It must match this JSON Schema exactly, including each slide's "type" value, every field marked required, and the limits written in each description:
${JSON.stringify(toStructuredOutputSchema(DeckSchema))}`;
  return systemPrompt;
}

/** The JSON object in a reply, tolerating a code fence or a stray line around it. */
export function extractJson(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
}

function textOf(message: Anthropic.Message): string {
  return message.content.map(b => (b.type === "text" ? b.text : "")).join("");
}

export async function generateDeck(apiKey: string, input: GenerateDeckInput, client = new Anthropic({ apiKey })): Promise<GenerateDeckResult> {
  if (!input.notes.trim()) throw new DeckGenerationError("Add some notes first.", "empty");
  const model: ClaudeModelId = input.model ?? (DEFAULT_MODEL.anthropic as ClaudeModelId);
  const effort = getAiModel(model).effort ?? "high";

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildUserMessage(input) }];
  const usage = { input: 0, output: 0 };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const message = await client.messages
      .stream({
        model,
        max_tokens: 64000,
        system: deckSystemPrompt(),
        output_config: { effort },
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
      json = JSON.parse(extractJson(raw));
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
