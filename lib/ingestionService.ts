import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import type { PresentationAST, SlideNode, SlideType } from "@/types/slideAst";
import { STUDENT_LEVEL_GUIDANCE, type StudentLevel } from "@/lib/studentLevel";

/**
 * System prompt for the ingestion pipeline. Kept as its own exported constant
 * (rather than inlined in the request) so it can be unit-tested or reused by
 * a future "regenerate slide" / "expand this point" follow-up call.
 */
export const CURRICULUM_ARCHITECT_SYSTEM_PROMPT = `You are a Senior Curriculum Architect and Instructional Designer. Your task is to transform raw, unstructured user input (such as meeting notes, rough brain-dumps, or loose bullet points) into a deeply detailed, visually engaging presentation structure.

Core Objectives:
1. Semantic Chunking: Logically break the input text down into logical instructional sections.
2. Instructional Expansion: Do not leave points sparse. If a user writes a brief note (e.g., "talk about error handling"), expand it by adding:
   - A concise technical definition.
   - A real-world use case or "why it matters".
   - An "Instructor Note" or pro-tip to help the educator deliver the concept effectively.
3. Dynamic Layout Mapping: Assign the most appropriate slide component type based on the content's nature — vary it deliberately, don't fall into a repetitive cycle (e.g. always alternating the same two types, or defaulting everything to \`standard\`). Re-evaluate each section on its own merits:
   - Use \`standard\` for core concepts, general overviews, and prose-heavy material that doesn't fit any of the categories below.
   - Use \`split-column\` for comparisons, pros/cons, trade-offs, or conceptual-vs-practical breakdowns.
   - Use \`code-explainer\` whenever code syntax, configuration snippets, or commands are referenced — never render code as plain prose in a \`standard\` slide.
   - Use \`callout\` for crucial warnings, best practices, tips, or instructor call-outs — anything that reads as an aside rather than core content.
   - Use \`step-grid\` for chronological workflows, setup instructions, or sequential guides.
4. Mandatory Topic Coverage: If the user turn lists required topics or headings, create one dedicated slide per topic, titled to clearly match that topic (verbatim or near-verbatim). Never omit a required topic and don't silently merge two of them into a single slide unless they are genuinely inseparable — you may still add extra slides beyond the required ones for anything else the raw notes cover.
5. Source Verification: If "Reference Sources" URLs are listed under LESSON CONTEXT, use the web_fetch tool on at most the 2-3 most relevant ones before writing those slides — don't rely on training data alone when a source is right there, but don't fetch every source listed either. Use the web_search tool sparingly and at most once or twice, only when the raw notes reference specific current facts (recent versions, prices, dates, statistics) you're not confident about — don't search for general concepts you already know well. These tools are a supplement, not a research project: prioritize finishing the presentation over exhaustively verifying every claim.

Output Requirements:
- You must output strictly valid JSON matching the PresentationAST TypeScript schema structure.`;

const VALID_SLIDE_TYPES: SlideType[] = [
  "standard",
  "split-column",
  "code-explainer",
  "callout",
  "step-grid",
];

interface IngestionOptions {
  /** Known audience if the caller already has it (e.g. a grade level or prior-course context). Otherwise the model infers it. */
  targetAudience?: string;
  /** Soft guidance on how many slides to produce; the model may deviate slightly to fit the content. */
  slideCount?: number;
  /** Course-level mandatory headings/topics (e.g. course.settings.requiredSlideTopics) — each gets its own slide, never omitted. */
  requiredTopics?: string[];
  /** Same three-tier level as Lesson.studentLevel — resolved into full guidance text, mirroring how fillLesson uses it in lib/ai.ts. */
  studentLevel?: StudentLevel;
  /** Known lesson title/subtitle from Lesson Info — given as background context, not copied verbatim (the notes may warrant a different in-deck title). */
  lessonTitle?: string;
  lessonSubtitle?: string;
  /** Comma-separated topics from Lesson Info — same context role "Topics" plays in fillLesson's prompt. */
  topics?: string;
  /** Reference URLs from Lesson Info (one per line) — same context role "Sources" plays in fillLesson's prompt. */
  sources?: string;
}

// Restating the schema as a compact JSON-shape reference (rather than pasting the .ts file)
// keeps the prompt shorter while still pinning down every field name the model must emit.
const SCHEMA_REFERENCE = `{
  "lessonTitle": "string",
  "targetAudience": "string",
  "slides": [
    // type: "standard"
    { "id": "string", "type": "standard", "title": "string", "subtitle": "string?", "paragraphs": ["string"], "bulletPoints": ["string"]? },
    // type: "split-column"
    { "id": "string", "type": "split-column", "title": "string", "subtitle": "string?",
      "leftColumn": { "heading": "string", "content": ["string"] },
      "rightColumn": { "heading": "string", "content": ["string"] } },
    // type: "code-explainer"
    { "id": "string", "type": "code-explainer", "title": "string", "subtitle": "string?",
      "language": "string", "codeSnippet": "string", "explanationPoints": ["string"] },
    // type: "callout"
    { "id": "string", "type": "callout", "title": "string", "subtitle": "string?",
      "variant": "warning" | "tip" | "instructor-note", "content": "string" },
    // type: "step-grid"
    { "id": "string", "type": "step-grid", "title": "string", "subtitle": "string?",
      "steps": [{ "stepNumber": 1, "title": "string", "description": "string" }] }
  ]
}`;

function buildUserPrompt(rawText: string, opts: IngestionOptions): string {
  const audienceLine = opts.targetAudience
    ? `The target audience is already known: ${opts.targetAudience}. Use this exact value for "targetAudience" unless the raw notes clearly contradict it.`
    : `Infer "targetAudience" from the raw notes and the student level guidance below.`;
  const countLine = opts.slideCount
    ? `Aim for approximately ${opts.slideCount} slides — prioritize instructional clarity over hitting this exactly.`
    : `Choose however many slides the content naturally warrants — don't pad or compress just to hit a round number.`;
  const requiredTopicsLine = opts.requiredTopics && opts.requiredTopics.length > 0
    ? `\nThis course REQUIRES a dedicated slide for each of the following topics — do not omit any of them, even if the raw notes don't mention them directly (use your own instructional judgment to cover a required topic the notes are silent on):\n${opts.requiredTopics.map(t => `- ${t}`).join("\n")}\n`
    : "";
  const levelLine = opts.studentLevel
    ? `\nStudent Level Guidance: ${STUDENT_LEVEL_GUIDANCE[opts.studentLevel]}\n`
    : "";

  // Same context role Title/Subtitle/Topics/Sources play in fillLesson's prompt (lib/ai.ts) —
  // background for framing, not raw material to transcribe onto slides.
  const contextLines: string[] = [];
  if (opts.lessonTitle) contextLines.push(`Lesson Title: ${opts.lessonTitle}`);
  if (opts.lessonSubtitle) contextLines.push(`Lesson Subtitle: ${opts.lessonSubtitle}`);
  if (opts.topics) contextLines.push(`Topics: ${opts.topics}`);
  if (opts.sources) contextLines.push(`Reference Sources:\n${opts.sources}`);
  const lessonContextBlock = contextLines.length > 0
    ? `\n--- LESSON CONTEXT (background/framing only — the raw content below is still the primary source of slide material) ---\n${contextLines.join("\n")}\n--- END LESSON CONTEXT ---\n`
    : "";

  return `Transform the following raw content into a PresentationAST.
${lessonContextBlock}
--- RAW CONTENT ---
${rawText}
--- END RAW CONTENT ---

${audienceLine}
${countLine}
${levelLine}${requiredTopicsLine}Give every slide a unique "id" (a short unique string is fine — it does not need to be a real UUID).

Respond with ONLY the JSON object — no markdown code fences, no commentary before or after. It must match this exact shape (the "type" field determines which of the sibling keys are present on that slide):

${SCHEMA_REFERENCE}`;
}

function extractJson(text: string): string {
  const stripped = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  return start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;
}

function parseAst(jsonStr: string): unknown {
  try {
    return JSON.parse(jsonStr);
  } catch {
    // The model occasionally emits literal newlines inside JSON string values (common with
    // multi-paragraph "content"/"paragraphs" fields) — same repair pass used in lib/ai.ts.
    const cleaned = jsonStr.replace(/:\s*"([\s\S]*?)"\s*([,}])/g, (_, val, tail) =>
      `: "${val.replace(/\n/g, "\\n").replace(/\r/g, "").replace(/"/g, '\\"')}"${tail}`
    );
    return JSON.parse(cleaned);
  }
}

/**
 * Throws with a specific message on the first structural problem found, rather than failing
 * silently downstream in the renderer. Exported so the Google Slides export route can re-validate
 * a client-supplied AST before spending Slides API calls building a deck from it.
 */
export function assertValidAst(value: unknown): asserts value is PresentationAST {
  if (!value || typeof value !== "object") throw new Error("AI response was not a JSON object.");
  const ast = value as Partial<PresentationAST>;
  if (typeof ast.lessonTitle !== "string") throw new Error("AI response is missing \"lessonTitle\".");
  if (typeof ast.targetAudience !== "string") throw new Error("AI response is missing \"targetAudience\".");
  if (!Array.isArray(ast.slides) || ast.slides.length === 0) {
    throw new Error("AI response did not include any slides.");
  }
  ast.slides.forEach((slide, i) => {
    const type = (slide as Partial<SlideNode>)?.type;
    if (!VALID_SLIDE_TYPES.includes(type as SlideType)) {
      throw new Error(`Slide ${i + 1} has an invalid or missing "type": ${JSON.stringify(type)}.`);
    }
  });
}

/** Parses a course's `requiredSlideTopics` (one topic per line, same convention as `defaultSources`) into a clean list. */
export function parseRequiredTopics(raw: string | undefined): string[] {
  return (raw ?? "").split("\n").map(s => s.trim()).filter(Boolean);
}

/** Fills in a slide id when the model omitted or duplicated one — ids are used as React keys downstream. */
function normalizeSlideIds(ast: PresentationAST): PresentationAST {
  const seen = new Set<string>();
  const slides = ast.slides.map((slide) => {
    const needsId = !slide.id || seen.has(slide.id);
    const id = needsId ? uuidv4() : slide.id;
    seen.add(id);
    return needsId ? { ...slide, id } : slide;
  });
  return { ...ast, slides };
}

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
  opts: IngestionOptions = {}
): Promise<PresentationAST> {
  if (!rawText.trim()) throw new Error("Nothing to ingest — the input was empty.");

  const client = new Anthropic({ apiKey });
  const userContent = buildUserPrompt(rawText, opts);
  const requestParams = {
    model: "claude-opus-5" as const,
    max_tokens: 24000,
    thinking: { type: "adaptive" as const },
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
