/**
 * Claude models offered for deck generation. Kept free of SDK imports so the client-side picker
 * can use the same list without pulling the Anthropic SDK into the browser bundle.
 */
export const DECK_MODELS = [
  { id: "claude-opus-5-5", label: "Opus 5.5", hint: "Best quality for full session decks", effort: "high" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", hint: "Faster and cheaper, still strong", effort: "high" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", hint: "Fastest and cheapest, for short lessons", effort: "medium" },
] as const;

export type DeckModelId = (typeof DECK_MODELS)[number]["id"];
export const DEFAULT_DECK_MODEL: DeckModelId = "claude-opus-5-5";

export function isDeckModelId(v: unknown): v is DeckModelId {
  return typeof v === "string" && DECK_MODELS.some(m => m.id === v);
}
