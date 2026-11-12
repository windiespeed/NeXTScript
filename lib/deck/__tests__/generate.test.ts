import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { DeckSchema } from "@/lib/deck/schema";
import { SAMPLE_DECK } from "@/lib/deck/sample";
import { DeckGenerationError, buildUserMessage, deckSystemPrompt, describeIssues, extractJson, generateDeck } from "@/lib/deck/generate";
import { toStructuredOutputSchema } from "@/lib/deck/wireSchema";

function walk(node: unknown, visit: (n: Record<string, unknown>) => void) {
  if (Array.isArray(node)) return node.forEach(n => walk(n, visit));
  if (!node || typeof node !== "object") return;
  visit(node as Record<string, unknown>);
  Object.values(node).forEach(v => walk(v, visit));
}

describe("structured-output schema", () => {
  const schema = toStructuredOutputSchema(DeckSchema);
  const json = JSON.stringify(schema);

  it("keeps only keywords structured outputs accept", () => {
    walk(schema, n => {
      for (const k of ["minLength", "maxLength", "maxItems", "minimum", "maximum", "oneOf", "pattern"]) expect(n[k], k).toBeUndefined();
      if (n.minItems !== undefined) expect([0, 1]).toContain(n.minItems);
      if (n.type === "object") expect(n.additionalProperties).toBe(false);
    });
  });

  it("keeps the slide type discriminator and enums enforceable", () => {
    expect(json).toContain('"const":"concept"');
    expect(json).toContain('"const":"exit-ticket"');
    expect(json).toContain('"enum":["key-idea","tip","warning","instructor-note"]');
  });

  it("spells the limits out for the model", () => {
    expect(json).toContain("At most 130 characters.");
    expect(json).toContain("1 to 5 items.");
  });
});

function fakeClient(responses: Partial<Anthropic.Message>[]) {
  const calls: Anthropic.MessageStreamParams[] = [];
  const client = {
    messages: {
      stream(params: Anthropic.MessageStreamParams) {
        calls.push(structuredClone(params));
        const r = responses.shift()!;
        return { finalMessage: async () => ({ usage: { input_tokens: 10, output_tokens: 20 }, stop_reason: "end_turn", ...r }) };
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

const text = (s: string) => ({ content: [{ type: "text", text: s, citations: null }] as Anthropic.ContentBlock[] });

describe("generateDeck", () => {
  it("returns a valid deck from the first response", async () => {
    const { client, calls } = fakeClient([text(JSON.stringify(SAMPLE_DECK))]);
    const r = await generateDeck("k", { notes: "components and props", lessonTitle: "React" }, client);
    expect(r.attempts).toBe(1);
    expect(r.deck.slides).toHaveLength(SAMPLE_DECK.slides.length);
    expect(r.model).toBe("claude-sonnet-5-5");
    const params = calls[0] as unknown as { output_config: { effort: string; format?: unknown }; system: string };
    // No structured-output grammar: the API rejects the deck schema's grammar as too large.
    expect(params.output_config.format).toBeUndefined();
    expect(params.output_config.effort).toBe("high");
    expect(params.system).toBe(deckSystemPrompt());
    expect(params.system).toContain('"const":"exit-ticket"');
  });

  it("asks once for a fix when a limit is broken, naming the slide", async () => {
    const bad = structuredClone(SAMPLE_DECK);
    const concept = bad.slides.find(s => s.type === "concept")!;
    if (concept.type === "concept") concept.bullets[0] = "x".repeat(200);
    const { client, calls } = fakeClient([text(JSON.stringify(bad)), text(JSON.stringify(SAMPLE_DECK))]);
    const r = await generateDeck("k", { notes: "n" }, client);
    expect(r.attempts).toBe(2);
    expect(r.usage).toEqual({ input: 20, output: 40 });
    const repair = calls[1].messages.at(-1)!.content as string;
    expect(repair).toContain(`slide "${concept.id}" (concept), bullets.0`);
    expect(calls[1].messages).toHaveLength(3);
  });

  it("reads JSON wrapped in a code fence", async () => {
    const { client } = fakeClient([text("```json\n" + JSON.stringify(SAMPLE_DECK) + "\n```")]);
    const r = await generateDeck("k", { notes: "n" }, client);
    expect(r.attempts).toBe(1);
    expect(extractJson("no json")).toBe("no json");
  });

  it("gives up after one repair", async () => {
    const { client } = fakeClient([text("{}"), text("not json")]);
    await expect(generateDeck("k", { notes: "n" }, client)).rejects.toMatchObject({ reason: "invalid" });
  });

  it("reports refusals and truncation plainly", async () => {
    const refused = fakeClient([{ ...text(""), stop_reason: "refusal" }]);
    await expect(generateDeck("k", { notes: "n" }, refused.client)).rejects.toBeInstanceOf(DeckGenerationError);
    const cut = fakeClient([{ ...text("{"), stop_reason: "max_tokens" }]);
    await expect(generateDeck("k", { notes: "n" }, cut.client)).rejects.toMatchObject({ reason: "max_tokens" });
  });

  it("refuses empty notes without calling the API", async () => {
    const { client, calls } = fakeClient([]);
    await expect(generateDeck("k", { notes: "  " }, client)).rejects.toMatchObject({ reason: "empty" });
    expect(calls).toHaveLength(0);
  });

  it("builds the user message from the inputs", () => {
    const m = buildUserMessage({ notes: "props\n", lessonTitle: "React", context: "Week 6" });
    expect(m).toContain("Lesson: React");
    expect(m).toContain("<notes>\nprops\n</notes>");
  });

  it("describes issues outside slides too", () => {
    expect(describeIssues([{ path: ["lessonTitle"], message: "Too big" }], {})).toBe("- lessonTitle: Too big");
  });
});
