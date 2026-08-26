import Anthropic from "@anthropic-ai/sdk";
import type { PresentationAST } from "@/types/slideAst";
import { INGEST_MODEL_OPTIONS, DEFAULT_INGEST_MODEL, type IngestModelId } from "@/lib/ingestModels";
import {
  CURRICULUM_ARCHITECT_SYSTEM_PROMPT,
  buildUserPrompt,
  extractJson,
  parseAst,
  assertValidAst,
  normalizeSlideIds,
  type IngestionOptions,
} from "@/lib/ingestionPrompt";

/**
 * Sends raw, unstructured text (meeting notes, brain-dumps, loose bullet points) to Claude and
 * returns a fully-typed PresentationAST ready for `<SlideRenderer />`.
 *
 * Mirrors the calling convention of `fillLesson`/`generateQuizQuestions` in `lib/ai.ts`: the
 * caller's own Anthropic API key is passed in (fetched from `userSettings` at the route level),
 * not read from a server-wide env var.
 */
export async function ingestRawContent(
  apiKey: string,
  rawText: string,
  opts: IngestionOptions & { model?: IngestModelId } = {}
): Promise<PresentationAST> {
  if (!rawText.trim()) throw new Error("Nothing to ingest — the input was empty.");

  const client = new Anthropic({ apiKey });
  const userContent = buildUserPrompt(rawText, opts);
  const modelId = opts.model ?? DEFAULT_INGEST_MODEL;
  // Adaptive thinking is only supported on 4.6-tier-and-newer models — Haiku 4.5 rejects
  // the `thinking` param outright, so it's only included for models that support it.
  const supportsAdaptiveThinking = INGEST_MODEL_OPTIONS.find(m => m.id === modelId)?.supportsAdaptiveThinking ?? false;
  const requestParams = {
    model: modelId,
    max_tokens: 24000,
    ...(supportsAdaptiveThinking ? { thinking: { type: "adaptive" as const } } : {}),
    system: CURRICULUM_ARCHITECT_SYSTEM_PROMPT,
    tools: [
      { type: "web_fetch_20260209" as const, name: "web_fetch" as const, max_uses: 5 },
      { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 3 },
    ],
  };

  // Streaming (not .create()) — at this max_tokens the SDK refuses a non-streaming call
  // outright ("Streaming is required for operations that may take longer than 10 minutes"),
  // and streaming is the right call anyway given thinking + tool use can run long.
  // .finalMessage() drives the stream to completion internally and returns the same
  // Message shape .create() would have.
  let message = await client.messages.stream({
    ...requestParams,
    messages: [{ role: "user", content: userContent }],
  }).finalMessage();

  // The server-side web_fetch/web_search tool loop can hit its internal iteration cap
  // mid-task and pause with stop_reason "pause_turn" before ever producing final text —
  // billed tokens with nothing to show for it if left unhandled. Resend (per Anthropic's
  // documented pause_turn pattern) so it picks up where it left off, bounded so a
  // pathological loop can't run away and rack up cost indefinitely.
  let continuations = 0;
  while (message.stop_reason === "pause_turn" && continuations < 3) {
    message = await client.messages.stream({
      ...requestParams,
      messages: [
        { role: "user", content: userContent },
        { role: "assistant", content: message.content },
      ],
    }).finalMessage();
    continuations++;
  }

  // With server-side tools enabled, earlier text blocks may be commentary/search
  // narration rather than the final answer — the last text block is the real one.
  const textBlock = [...message.content].reverse().find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`The AI did not return a text response (stopped: ${message.stop_reason}). Please try again.`);
  }

  let parsed: unknown;
  try {
    parsed = parseAst(extractJson(textBlock.text));
  } catch {
    throw new Error("The AI's response could not be parsed as JSON. Please try again.");
  }

  assertValidAst(parsed);
  return normalizeSlideIds(parsed);
}
