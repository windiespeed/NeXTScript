/**
 * The AI models NeXTScript can generate slides with, and how one is picked. Instructors don't
 * choose on the generator screens: the model comes from whichever API key they've saved, plus an
 * optional preference under Profile → Advanced. Kept free of SDK and server imports so the client
 * (to show which model will run) and the API routes (which actually decide) share one source.
 */

export type AiProvider = "anthropic" | "gemini";

export const AI_MODELS = [
  { id: "claude-opus-5-5", provider: "anthropic", label: "Claude Opus 5.5", hint: "Best quality, slower and about twice the cost of Sonnet", effort: "high" },
  { id: "claude-sonnet-5-5", provider: "anthropic", label: "Claude Sonnet 5.5", hint: "Strong quality, faster and cheaper (default)", effort: "high" },
  { id: "claude-haiku-5-5", provider: "anthropic", label: "Claude Haiku 5.5", hint: "Fastest and cheapest, for short lessons", effort: "medium" },
  { id: "gemini-3.1-pro-preview", provider: "gemini", label: "Gemini 3.1 Pro", hint: "Best Gemini quality, slower", effort: null },
  { id: "gemini-3.7-flash", provider: "gemini", label: "Gemini 3.7 Flash", hint: "Strong quality, faster and cheaper (default for Gemini)", effort: null },
  { id: "gemini-3.1-flash-lite", provider: "gemini", label: "Gemini 3.1 Flash-Lite", hint: "Fastest and cheapest, for short lessons", effort: null },
] as const;

export type AiModel = (typeof AI_MODELS)[number];
export type AiModelId = AiModel["id"];
export type ClaudeModelId = Extract<AiModel, { provider: "anthropic" }>["id"];

/** "auto" = use the default model for whichever key is saved. */
export type AiModelPreference = "auto" | AiModelId;

/** Mid-priced defaults: good quality, and quick enough to stay well inside Vercel's 300s limit. */
export const DEFAULT_MODEL: Record<AiProvider, AiModelId> = {
  anthropic: "claude-sonnet-5-5",
  gemini: "gemini-3.7-flash",
};

export function isAiModelId(value: unknown): value is AiModelId {
  return typeof value === "string" && AI_MODELS.some(m => m.id === value);
}

export function getAiModel(id: AiModelId): AiModel {
  return AI_MODELS.find(m => m.id === id)!;
}

export interface SavedKeys {
  anthropic: boolean;
  gemini: boolean;
}

/**
 * Picks the model a generator will use. The saved preference wins when its provider's key is
 * saved and the generator supports that provider; otherwise the default for an available key,
 * Claude first. Returns null when no usable key is saved.
 */
export function resolveAiModel(
  preference: unknown,
  keys: SavedKeys,
  providers: readonly AiProvider[] = ["anthropic", "gemini"],
): AiModelId | null {
  if (isAiModelId(preference)) {
    const { provider } = getAiModel(preference);
    if (providers.includes(provider) && keys[provider]) return preference;
  }
  for (const provider of ["anthropic", "gemini"] as const) {
    if (providers.includes(provider) && keys[provider]) return DEFAULT_MODEL[provider];
  }
  return null;
}
