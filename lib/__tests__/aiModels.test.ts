import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, resolveAiModel } from "@/lib/aiModels";

const both = { anthropic: true, gemini: true };
const claudeOnly = { anthropic: true, gemini: false };
const geminiOnly = { anthropic: false, gemini: true };
const none = { anthropic: false, gemini: false };

describe("resolveAiModel", () => {
  it("defaults to the mid-priced Claude model, Claude first", () => {
    expect(resolveAiModel("auto", both)).toBe(DEFAULT_MODEL.anthropic);
    expect(resolveAiModel(undefined, claudeOnly)).toBe("claude-sonnet-5-5");
  });

  it("falls back to Gemini when that is the only key", () => {
    expect(resolveAiModel("auto", geminiOnly)).toBe("gemini-3.7-flash");
  });

  it("uses a saved preference when its key is saved", () => {
    expect(resolveAiModel("claude-opus-5-5", both)).toBe("claude-opus-5-5");
    expect(resolveAiModel("gemini-3.1-pro-preview", both)).toBe("gemini-3.1-pro-preview");
  });

  it("ignores a preference whose key is missing or that is unknown", () => {
    expect(resolveAiModel("gemini-3.1-pro-preview", claudeOnly)).toBe("claude-sonnet-5-5");
    expect(resolveAiModel("claude-opus-5", both)).toBe("claude-sonnet-5-5");
  });

  it("respects a Claude-only generator", () => {
    expect(resolveAiModel("gemini-3.7-flash", both, ["anthropic"])).toBe("claude-sonnet-5-5");
    expect(resolveAiModel("auto", geminiOnly, ["anthropic"])).toBeNull();
  });

  it("returns null with no keys", () => {
    expect(resolveAiModel("auto", none)).toBeNull();
  });
});
