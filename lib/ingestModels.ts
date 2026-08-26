/**
 * Model choices exposed on the Notes to Slides picker. Kept in its own file (no server-only
 * imports) so both the client page and the server-side ingestion services can share one source
 * of truth without pulling either provider's SDK into the client bundle.
 */
export const INGEST_MODEL_OPTIONS = [
  {
    id: "claude-opus-5",
    provider: "anthropic",
    label: "Opus 5",
    hint: "Most capable, highest cost — best for long or complex notes",
    supportsAdaptiveThinking: true,
  },
  {
    id: "claude-sonnet-5",
    provider: "anthropic",
    label: "Sonnet 5",
    hint: "Faster and cheaper than Opus, still strong quality",
    supportsAdaptiveThinking: true,
  },
  {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    label: "Haiku 4.5",
    hint: "Fastest and lowest cost — best for short, simple notes",
    supportsAdaptiveThinking: false,
  },
  {
    id: "gemini-3.1-pro-preview",
    provider: "gemini",
    label: "Gemini 3.1 Pro",
    hint: "Most capable Gemini tier — best for long or complex notes",
    supportsAdaptiveThinking: false,
  },
  {
    id: "gemini-3.7-flash",
    provider: "gemini",
    label: "Gemini 3.7 Flash",
    hint: "Faster and cheaper than Pro, still strong quality",
    supportsAdaptiveThinking: false,
  },
  {
    id: "gemini-3.1-flash-lite",
    provider: "gemini",
    label: "Gemini 3.1 Flash-Lite",
    hint: "Fastest and lowest cost — best for short, simple notes",
    supportsAdaptiveThinking: false,
  },
] as const;

export type IngestModelId = (typeof INGEST_MODEL_OPTIONS)[number]["id"];
export type IngestProvider = (typeof INGEST_MODEL_OPTIONS)[number]["provider"];

export const DEFAULT_INGEST_MODEL: IngestModelId = "claude-opus-5";

export function isIngestModelId(value: unknown): value is IngestModelId {
  return typeof value === "string" && INGEST_MODEL_OPTIONS.some(m => m.id === value);
}

export function getIngestModel(id: IngestModelId) {
  return INGEST_MODEL_OPTIONS.find(m => m.id === id)!;
}
