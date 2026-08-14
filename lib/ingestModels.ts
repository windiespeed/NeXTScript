/**
 * Model choices exposed on the Notes to Slides picker. Kept in its own file (no server-only
 * imports) so both the client page and the server-side ingestion service can share one source
 * of truth without pulling the Anthropic SDK into the client bundle.
 */
export const INGEST_MODEL_OPTIONS = [
  {
    id: "claude-opus-5",
    label: "Opus 5",
    hint: "Most capable, highest cost — best for long or complex notes",
    supportsAdaptiveThinking: true,
  },
  {
    id: "claude-sonnet-5",
    label: "Sonnet 5",
    hint: "Faster and cheaper than Opus, still strong quality",
    supportsAdaptiveThinking: true,
  },
  {
    id: "claude-haiku-4-5",
    label: "Haiku 4.5",
    hint: "Fastest and lowest cost — best for short, simple notes",
    supportsAdaptiveThinking: false,
  },
] as const;

export type IngestModelId = (typeof INGEST_MODEL_OPTIONS)[number]["id"];

export const DEFAULT_INGEST_MODEL: IngestModelId = "claude-opus-5";

export function isIngestModelId(value: unknown): value is IngestModelId {
  return typeof value === "string" && INGEST_MODEL_OPTIONS.some(m => m.id === value);
}
