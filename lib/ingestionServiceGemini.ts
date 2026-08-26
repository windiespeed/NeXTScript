import { GoogleGenAI } from "@google/genai";
import type { PresentationAST } from "@/types/slideAst";
import type { IngestModelId } from "@/lib/ingestModels";
import {
  CURRICULUM_ARCHITECT_SYSTEM_PROMPT,
  PRESENTATION_AST_JSON_SCHEMA,
  buildUserPrompt,
  extractJson,
  parseAst,
  assertValidAst,
  normalizeSlideIds,
  type IngestionOptions,
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
  opts: IngestionOptions & { model?: IngestModelId } = {}
): Promise<PresentationAST> {
  if (!rawText.trim()) throw new Error("Nothing to ingest — the input was empty.");

  const client = new GoogleGenAI({ apiKey });
  const userContent = buildUserPrompt(rawText, opts);
  const modelId = opts.model ?? "gemini-3.1-pro-preview";

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
  return normalizeSlideIds(parsed);
}
