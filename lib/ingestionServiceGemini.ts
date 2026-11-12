import { GoogleGenAI } from "@google/genai";
import type { PresentationAST } from "@/types/slideAst";
import { DEFAULT_MODEL, type AiModelId } from "@/lib/aiModels";
import {
  CURRICULUM_ARCHITECT_SYSTEM_PROMPT,
  OUTLINE_SYSTEM_PROMPT,
  PRESENTATION_AST_JSON_SCHEMA,
  buildOutlinePrompt,
  buildUserPrompt,
  extractJson,
  parseAst,
  assertValidAst,
  moveInstructorNotes,
  normalizeSlideIds,
  toOutline,
  type IngestionOptions,
  type Outline,
} from "@/lib/ingestionPrompt";

/**
 * Gemini counterpart to `ingestRawContent` in lib/ingestionService.ts — same contract, same
 * prompt/parsing/validation pipeline (shared via lib/ingestionPrompt.ts), different provider.
 *
 * Uses the Gemini Interactions API (`client.interactions.create`), Google's current recommended
 * surface for combining structured output with tool use in one call. Structured output here is
 * a real JSON Schema (PRESENTATION_AST_JSON_SCHEMA) rather than Claude's prose-described schema,
 * but Gemini's enforcement of a discriminated-union schema isn't guaranteed as strict as
 * Anthropic's tool-use path — assertValidAst is still the real safety net either way.
 */
export async function ingestRawContentGemini(
  apiKey: string,
  rawText: string,
  opts: IngestionOptions & { model?: AiModelId } = {}
): Promise<PresentationAST> {
  if (!rawText.trim()) throw new Error("Nothing to ingest — the input was empty.");

  const client = new GoogleGenAI({ apiKey });
  const userContent = buildUserPrompt(rawText, opts);
  const modelId = opts.model ?? DEFAULT_MODEL.gemini;

  const interaction = await client.interactions.create({
    model: modelId,
    input: userContent,
    system_instruction: CURRICULUM_ARCHITECT_SYSTEM_PROMPT,
    tools: [{ type: "google_search" }],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: PRESENTATION_AST_JSON_SCHEMA,
    },
    generation_config: {
      max_output_tokens: 24000,
    },
  });

  const text = interaction.output_text;
  if (!text) {
    throw new Error("The AI did not return a text response. Please try again.");
  }

  let parsed: unknown;
  try {
    parsed = parseAst(extractJson(text));
  } catch {
    throw new Error("The AI's response could not be parsed as JSON. Please try again.");
  }

  assertValidAst(parsed);
  return moveInstructorNotes(normalizeSlideIds(parsed));
}

/** Gemini counterpart to `outlineRawContent` in lib/ingestionService.ts. */
export async function outlineRawContentGemini(
  apiKey: string,
  rawText: string,
  opts: IngestionOptions & { model?: AiModelId } = {}
): Promise<Outline> {
  if (!rawText.trim()) throw new Error("Nothing to plan — the input was empty.");
  const client = new GoogleGenAI({ apiKey });
  const interaction = await client.interactions.create({
    model: opts.model ?? DEFAULT_MODEL.gemini,
    input: buildOutlinePrompt(rawText, opts),
    system_instruction: OUTLINE_SYSTEM_PROMPT,
    response_format: { type: "text", mime_type: "application/json" },
    generation_config: { max_output_tokens: 8000 },
  });
  const text = interaction.output_text;
  if (!text) throw new Error("The AI did not return an outline. Please try again.");
  try {
    return toOutline(parseAst(extractJson(text)));
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("The AI")) throw err;
    throw new Error("The AI's outline could not be read. Please try again.");
  }
}
