import { v4 as uuidv4 } from "uuid";
import type { PresentationAST, SlideNode, SlideType } from "@/types/slideAst";
import { STUDENT_LEVEL_GUIDANCE, type StudentLevel } from "@/lib/studentLevel";
import { applySlideAnchors, type SlideAnchor } from "@/lib/slideAnchors";
import { describeProgram, type ProgramContext } from "@/lib/programContext";

/**
 * Provider-agnostic pieces of the Notes to Slides ingestion pipeline — the prompt, the schema
 * description, and the parsing/validation of whatever text comes back. Shared by every provider
 * service (lib/ingestionService.ts for Claude, lib/ingestionServiceGemini.ts for Gemini) so the
 * instructional content and the safety net around malformed output stay identical regardless of
 * which model produced it.
 */
export const CURRICULUM_ARCHITECT_SYSTEM_PROMPT = `You are a Senior Curriculum Architect and presentation designer who writes for any subject (English, math, science, history, health care, business, the arts, a trade, computing, or anything else) and any student level. Take the subject from the program and lesson details and the notes, use that field's own vocabulary and examples, and never assume the course is about technology. You build a slide deck from two inputs: a SKELETON of mandatory slide anchors defined by the course configuration, and CONTENT in the form of raw, unstructured user notes (meeting notes, rough outlines, brain-dumps, loose bullet points).

The slides are projected in a classroom, so they show only what students need to see. Everything the instructor needs to say goes in each slide's speaker notes.

Core Objectives:
1. Mandatory Anchors: You are given a list of mandatory course sections. Every one of them must appear, in the exact order given, as a slide whose "anchorId" is the id given and whose "label" is the section name copied character-for-character. Never rename, merge, reorder, or skip an anchor, and never give a non-anchor slide an "anchorId". If the notes say nothing about an anchor, still write that slide using your own instructional judgment for this lesson's topic.
2. Headlines: The section name already shows in the small label above the title, so every slide's "title" is a short headline in plain words that says what this slide is about or the point it makes (at most 60 characters), e.g. label "Guided Activity", title "Your first line of code". Never repeat the section name as the title. Supporting slides after an anchor follow the same rule.
3. Content Distribution: Distribute the notes under the anchors. When an anchor's material is too much for one slide, add supporting slides directly after that anchor slide (with their own headlines and no "anchorId"). Notes that fit no anchor go under the closest related anchor rather than being dropped. Don't add a title slide; the app makes the cover from "lessonTitle" and "lessonSubtitle".
4. Keep slides light: at most about 60 words of on-slide text per slide (title, label, notes and takeaway not counted). A standard slide has at most one short framing sentence in "paragraphs" and at most 4 bullets of at most 15 words each. Split a crowded slide into two rather than cramming. Explain in plain words with one concrete everyday example or analogy where it helps.
5. Speaker notes: Give every slide "notes" (2-5 sentences): what to say, a question to ask the class, what to watch for, and any instructor tips or delivery advice. Never put "Instructor Note", "Teacher Note" or delivery advice on the slide itself.
6. Takeaways: Most content slides get a "takeaway": one sentence of at most 15 words with the point students should leave with. Skip it when the slide already says its point plainly.
7. Dynamic Layout Mapping: Assign each slide the layout that shows its content best, and vary it deliberately; don't fall into a repetitive cycle or default everything to \`standard\`. Aim for no more than about a third of the slides being \`standard\`:
   - \`standard\`: a short framing sentence and a few bullets, for a core idea that doesn't fit the shapes below.
   - \`card-row\`: 2-4 parallel ideas side by side (roles, types, examples, parts). Each card has a short "tag" naming its role in 1-2 words (e.g. "Structure"), a heading, and a body of at most 20 words.
   - \`split-column\`: two sides compared (before/after, pros/cons, what you see vs. what happens).
   - \`table\`: comparing 2-6 things across 2-4 attributes. "columns" is the header row and every row has one cell per column, each at most 8 words.
   - \`step-grid\`: an ordered process, setup steps, or an activity's instructions (2-6 steps).
   - \`code-explainer\`: only when the subject involves code, formulas, configuration or commands and the notes reference them; never render code as prose. Keep the snippet short, and fill "output" with what running it prints or shows whenever that helps students see the result. Most subjects never need it.
   - \`callout\`: one crucial warning, best practice, or tip that should stand alone.
8. No Anchors Given: If the user turn lists no slide anchors, break the notes into instructional sections yourself, give each slide a short "label" naming its section, and apply the objectives above.
9. Outline: If the user turn includes an APPROVED OUTLINE, follow it slide for slide: same order, same headlines, same layouts, unless a slide breaks a rule above.
10. Source Verification: If "Reference Sources" URLs are listed under LESSON CONTEXT, use the web_fetch tool on at most the 2-3 most relevant ones before writing those slides — don't rely on training data alone when a source is right there, but don't fetch every source listed either. Use the web_search tool sparingly and at most once or twice, only when the raw notes reference specific current facts (recent versions, prices, dates, statistics) you're not confident about — don't search for general concepts you already know well. These tools are a supplement, not a research project: prioritize finishing the presentation over exhaustively verifying every claim.

Output Requirements:
- You must output strictly valid JSON matching the PresentationAST TypeScript schema structure.`;

export const VALID_SLIDE_TYPES: SlideType[] = [
  "standard",
  "split-column",
  "code-explainer",
  "callout",
  "step-grid",
  "card-row",
  "table",
];

export interface IngestionOptions {
  /** Known audience if the caller already has it (e.g. a grade level or prior-course context). Otherwise the model infers it. */
  targetAudience?: string;
  /** Soft guidance on how many slides to produce; the model may deviate slightly to fit the content. */
  slideCount?: number;
  /** Locked slide anchors from the course configuration (lib/slideAnchors.ts), in order. Each one
   * becomes a slide whose title is exactly the anchor label; the route enforces this afterwards too. */
  anchors?: SlideAnchor[];
  /** Same three-tier level as Lesson.studentLevel — resolved into full guidance text, mirroring how fillLesson uses it in lib/ai.ts. */
  studentLevel?: StudentLevel;
  /** Known lesson title/subtitle from Lesson Info — given as background context, not copied verbatim (the notes may warrant a different in-deck title). */
  lessonTitle?: string;
  lessonSubtitle?: string;
  /** The course's Industry and Subject Area (lib/programContext.ts) — tells the model what field it's writing for. */
  program?: Partial<ProgramContext>;
  /** Comma-separated topics from Lesson Info — same context role "Topics" plays in fillLesson's prompt. */
  topics?: string;
  /** Reference URLs from Lesson Info (one per line) — same context role "Sources" plays in fillLesson's prompt. */
  sources?: string;
  /** An outline the instructor reviewed (and maybe edited) before generating; the deck follows it. */
  outline?: OutlineItem[];
}

/** One planned slide in an outline: what the instructor reviews before the deck is written. */
export interface OutlineItem {
  /** Course section the slide belongs to (its label). */
  label?: string;
  /** The slide's headline. */
  title: string;
  /** Planned layout. */
  type?: SlideType;
  /** One line on what the slide covers. */
  summary?: string;
  /** Set when this slide is a locked course section. */
  anchorId?: string;
}

// Restating the schema as a compact JSON-shape reference (rather than pasting the .ts file)
// keeps the prompt shorter while still pinning down every field name the model must emit.
// Kept in sync by hand with PRESENTATION_AST_JSON_SCHEMA below — same shape, two different
// representations (prose example for Claude's prompt, real JSON Schema for Gemini's
// response_format). Update both together if PresentationAST ever changes.
const SCHEMA_REFERENCE = `{
  "lessonTitle": "string",
  "lessonSubtitle": "string (one-line tagline for the cover, at most 100 characters)",
  "targetAudience": "string",
  "slides": [
    // Every slide also has: "id", "label"?, "anchorId"? (anchors only), "title" (headline), "notes" (speaker notes), "takeaway"?
    // type: "standard"
    { "id": "string", "anchorId": "string?", "label": "string?", "type": "standard", "title": "string", "paragraphs": ["string"], "bulletPoints": ["string"]?, "notes": "string", "takeaway": "string?" },
    // type: "card-row"
    { "id": "string", "label": "string?", "type": "card-row", "title": "string",
      "cards": [{ "tag": "string?", "heading": "string", "body": "string" }], "notes": "string", "takeaway": "string?" },
    // type: "split-column"
    { "id": "string", "label": "string?", "type": "split-column", "title": "string",
      "leftColumn": { "heading": "string", "content": ["string"] },
      "rightColumn": { "heading": "string", "content": ["string"] }, "notes": "string", "takeaway": "string?" },
    // type: "table"
    { "id": "string", "label": "string?", "type": "table", "title": "string",
      "columns": ["string"], "rows": [["string"]], "notes": "string", "takeaway": "string?" },
    // type: "code-explainer"
    { "id": "string", "label": "string?", "type": "code-explainer", "title": "string",
      "language": "string", "codeSnippet": "string", "output": "string?", "explanationPoints": ["string"], "notes": "string", "takeaway": "string?" },
    // type: "callout"
    { "id": "string", "label": "string?", "type": "callout", "title": "string",
      "variant": "warning" | "tip" | "instructor-note", "content": "string", "notes": "string" },
    // type: "step-grid"
    { "id": "string", "label": "string?", "type": "step-grid", "title": "string",
      "steps": [{ "stepNumber": 1, "title": "string", "description": "string" }], "notes": "string", "takeaway": "string?" }
  ]
}`;

const str = { type: "string" };
const strList = { type: "array", items: str };

/** Fields every slide variant shares in the JSON Schema below. */
const commonSlideProps = {
  id: str,
  anchorId: str,
  label: str,
  title: str,
  subtitle: str,
  notes: str,
  takeaway: str,
};

const slideVariant = (type: SlideType, props: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties: { ...commonSlideProps, type: { const: type }, ...props },
  required: ["id", "type", "title", "notes", ...required],
});

/** Real JSON Schema (draft-7 style) for the same PresentationAST shape described in
 * SCHEMA_REFERENCE above — used by Gemini's structured-output `response_format.schema`, which
 * needs an actual schema object rather than a prose example. Every slide-type variant is listed
 * under `anyOf` since a slide's required fields depend on its `type`. This is a best-effort
 * constraint, not the source of truth for correctness — assertValidAst (below) is what actually
 * gates what this app accepts, since structured-output enforcement varies by provider/model. */
export const PRESENTATION_AST_JSON_SCHEMA = {
  type: "object",
  properties: {
    lessonTitle: str,
    lessonSubtitle: str,
    targetAudience: str,
    slides: {
      type: "array",
      items: {
        anyOf: [
          slideVariant("standard", { paragraphs: strList, bulletPoints: strList }, ["paragraphs"]),
          slideVariant("card-row", {
            cards: {
              type: "array",
              items: { type: "object", properties: { tag: str, heading: str, body: str }, required: ["heading", "body"] },
            },
          }, ["cards"]),
          slideVariant("split-column", {
            leftColumn: { type: "object", properties: { heading: str, content: strList }, required: ["heading", "content"] },
            rightColumn: { type: "object", properties: { heading: str, content: strList }, required: ["heading", "content"] },
          }, ["leftColumn", "rightColumn"]),
          slideVariant("table", { columns: strList, rows: { type: "array", items: strList } }, ["columns", "rows"]),
          slideVariant("code-explainer", { language: str, codeSnippet: str, output: str, explanationPoints: strList }, ["language", "codeSnippet", "explanationPoints"]),
          slideVariant("callout", { variant: { enum: ["warning", "tip", "instructor-note"] }, content: str }, ["variant", "content"]),
          slideVariant("step-grid", {
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: { stepNumber: { type: "number" }, title: str, description: str },
                required: ["stepNumber", "title", "description"],
              },
            },
          }, ["steps"]),
        ],
      },
    },
  },
  required: ["lessonTitle", "lessonSubtitle", "targetAudience", "slides"],
};

export function buildUserPrompt(rawText: string, opts: IngestionOptions): string {
  const audienceLine = opts.targetAudience
    ? `The target audience is already known: ${opts.targetAudience}. Use this exact value for "targetAudience" unless the raw notes clearly contradict it.`
    : `Infer "targetAudience" from the raw notes and the student level guidance below.`;
  const countLine = opts.slideCount
    ? `Aim for approximately ${opts.slideCount} slides — prioritize instructional clarity over hitting this exactly.`
    : `Choose however many slides the content naturally warrants — don't pad or compress just to hit a round number.`;
  const anchorBlock = opts.anchors && opts.anchors.length > 0
    ? `\n--- MANDATORY SLIDE ANCHORS (course skeleton, in this exact order) ---\n${opts.anchors.map((a, i) => `${i + 1}. label: ${JSON.stringify(a.label)}  anchorId: ${JSON.stringify(a.id)}`).join("\n")}\n--- END MANDATORY SLIDE ANCHORS ---\nEvery anchor above must appear exactly once, in this order, as a slide whose "label" is the section name verbatim, whose "anchorId" is the id shown, and whose "title" is your own short headline (not the section name). Distribute the raw content under these anchors; supporting slides may follow an anchor, carry the same "label", and have no "anchorId".\n`
    : `\nNo mandatory slide anchors are configured for this course — structure the deck from the notes alone.\n`;
  const levelLine = opts.studentLevel
    ? `\nStudent Level Guidance: ${STUDENT_LEVEL_GUIDANCE[opts.studentLevel]}\n`
    : "";
  const outlineBlock = opts.outline?.length
    ? `\n--- APPROVED OUTLINE (the instructor reviewed this; follow it slide for slide) ---\n${describeOutline(opts.outline)}\n--- END APPROVED OUTLINE ---\n`
    : "";

  // Same context role Title/Subtitle/Topics/Sources play in fillLesson's prompt (lib/ai.ts) —
  // background for framing, not raw material to transcribe onto slides.
  const contextLines: string[] = [];
  const program = describeProgram(opts.program);
  if (program) contextLines.push(`Program: ${program}`);
  if (opts.lessonTitle) contextLines.push(`Lesson Title: ${opts.lessonTitle}`);
  if (opts.lessonSubtitle) contextLines.push(`Lesson Subtitle: ${opts.lessonSubtitle}`);
  if (opts.topics) contextLines.push(`Topics: ${opts.topics}`);
  if (opts.sources) contextLines.push(`Reference Sources:\n${opts.sources}`);
  const lessonContextBlock = contextLines.length > 0
    ? `\n--- LESSON CONTEXT (background/framing only — the raw content below is still the primary source of slide material) ---\n${contextLines.join("\n")}\n--- END LESSON CONTEXT ---\n`
    : "";

  return `Build a PresentationAST from the course skeleton and the raw content below.
${lessonContextBlock}
--- RAW CONTENT ---
${rawText}
--- END RAW CONTENT ---

${audienceLine}
${countLine}
${levelLine}${anchorBlock}${outlineBlock}Give every slide a unique "id" (a short unique string is fine — it does not need to be a real UUID).

Respond with ONLY the JSON object — no markdown code fences, no commentary before or after. It must match this exact shape (the "type" field determines which of the sibling keys are present on that slide):

${SCHEMA_REFERENCE}`;
}

function describeOutline(outline: OutlineItem[]): string {
  return outline
    .map((o, i) => {
      const bits = [`${i + 1}. title: ${JSON.stringify(o.title)}`];
      if (o.label) bits.push(`label: ${JSON.stringify(o.label)}`);
      if (o.anchorId) bits.push(`anchorId: ${JSON.stringify(o.anchorId)}`);
      if (o.type) bits.push(`layout: ${o.type}`);
      const line = bits.join("  ");
      return o.summary ? `${line}\n   covers: ${o.summary}` : line;
    })
    .join("\n");
}

// ── Outline ─────────────────────────────────────────────────────────────────

/** System prompt for the quick outline pass that runs before the full deck, when asked for. */
export const OUTLINE_SYSTEM_PROMPT = `You plan slide decks for instructors in any subject and at any level. Given a course's mandatory sections and an instructor's rough notes, you write a short outline of the deck: one line per slide, in order, before any slide is written. The instructor reviews and edits the outline, then the deck is written from it.

Rules:
- Every mandatory section appears exactly once, in order, as a slide with that section's "anchorId" and its name copied character-for-character as "label". Supporting slides may follow a section's slide; they carry the same "label" and no "anchorId".
- "title" is a short headline in plain words (at most 60 characters) that says what the slide is about or the point it makes. Never repeat the section name as the title.
- "type" is the layout that will show the content best: standard, card-row, split-column, table, step-grid, code-explainer (only when the subject involves code, formulas or commands), or callout. Vary it; keep standard to about a third of the slides at most.
- "summary" is one line (at most 20 words) on what the slide will show.
- Don't plan a title slide; the cover is made from the lesson title.
- Output strictly valid JSON only.`;

const OUTLINE_SHAPE = `{
  "lessonTitle": "string",
  "lessonSubtitle": "string (one-line tagline for the cover)",
  "slides": [{ "label": "string?", "anchorId": "string?", "title": "string", "type": "standard" | "card-row" | "split-column" | "table" | "step-grid" | "code-explainer" | "callout", "summary": "string" }]
}`;

export function buildOutlinePrompt(rawText: string, opts: IngestionOptions): string {
  // Same lesson context and anchors as the deck prompt; only the requested output differs.
  const full = buildUserPrompt(rawText, { ...opts, outline: undefined });
  const context = full.slice(0, full.indexOf("Give every slide a unique"));
  return `${context.replace("Build a PresentationAST from the course skeleton and the raw content below.", "Plan an outline for a slide deck from the course skeleton and the raw content below.")}
Respond with ONLY the JSON object — no markdown code fences, no commentary. It must match this shape:

${OUTLINE_SHAPE}`;
}

export interface Outline {
  lessonTitle: string;
  lessonSubtitle?: string;
  slides: OutlineItem[];
}

const asText = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

/** Checks and tidies a parsed outline. Throws when there's nothing usable. */
export function toOutline(value: unknown): Outline {
  const o = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const raw = Array.isArray(o.slides) ? o.slides : [];
  const slides: OutlineItem[] = raw
    .map((item): OutlineItem | null => {
      const it = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const title = asText(it.title, 120);
      if (!title) return null;
      const type = VALID_SLIDE_TYPES.includes(it.type as SlideType) ? (it.type as SlideType) : undefined;
      const label = asText(it.label, 120);
      const anchorId = asText(it.anchorId, 200);
      const summary = asText(it.summary, 300);
      return { title, ...(label ? { label } : {}), ...(anchorId ? { anchorId } : {}), ...(type ? { type } : {}), ...(summary ? { summary } : {}) };
    })
    .filter((x): x is OutlineItem => !!x)
    .slice(0, 40);
  if (!slides.length) throw new Error("The AI didn't return an outline. Please try again.");
  const lessonSubtitle = asText(o.lessonSubtitle, 160);
  return { lessonTitle: asText(o.lessonTitle, 160) ?? "Lesson", ...(lessonSubtitle ? { lessonSubtitle } : {}), slides };
}

/**
 * Puts outline items back on the course skeleton: anchored items keep the course's exact label
 * and order, a missing section gets an item of its own, and unknown anchorIds are dropped.
 */
export function anchorOutline(outline: Outline, anchors: { id: string; label: string }[]): Outline {
  if (!anchors.length) return { ...outline, slides: outline.slides.map(({ anchorId: _drop, ...rest }) => rest) };
  const ast: PresentationAST = {
    lessonTitle: outline.lessonTitle,
    targetAudience: "",
    slides: outline.slides.map((o, i) => ({
      id: `o${i}`, type: "standard", title: o.title, paragraphs: [],
      ...(o.label ? { label: o.label } : {}), ...(o.anchorId ? { anchorId: o.anchorId } : {}),
    })),
  };
  const byId = new Map(outline.slides.map((o, i) => [`o${i}`, o]));
  const fixed = applySlideAnchors(ast, anchors).ast;
  return {
    ...outline,
    slides: fixed.slides.map(s => {
      const from = byId.get(s.id);
      return {
        title: s.title,
        ...(s.label ? { label: s.label } : {}),
        ...(s.anchorId ? { anchorId: s.anchorId } : {}),
        ...(from?.type ? { type: from.type } : {}),
        ...(from?.summary ? { summary: from.summary } : {}),
      };
    }),
  };
}

// ── Parsing and clean-up ────────────────────────────────────────────────────

/** A line of delivery advice that belongs in the speaker notes, not on the slide. */
const INSTRUCTOR_LINE = /^\s*(?:\*\*)?(?:instructor|teacher|facilitator|teaching)\s*(?:note|tip)s?(?:\*\*)?\s*[:\-–—]\s*/i;

/**
 * Safety net for prompt drift: moves "Instructor Note: …" lines out of a slide's visible text
 * and into its speaker notes.
 */
export function moveInstructorNotes(ast: PresentationAST): PresentationAST {
  const slides = ast.slides.map(slide => {
    const moved: string[] = [];
    const keep = (items: string[] | undefined) =>
      items?.filter(t => {
        if (typeof t === "string" && INSTRUCTOR_LINE.test(t)) {
          moved.push(t.replace(INSTRUCTOR_LINE, "").trim());
          return false;
        }
        return true;
      });
    let next: SlideNode = slide;
    switch (slide.type) {
      case "standard":
        next = { ...slide, paragraphs: keep(slide.paragraphs) ?? [], ...(slide.bulletPoints ? { bulletPoints: keep(slide.bulletPoints) } : {}) };
        break;
      case "split-column":
        next = {
          ...slide,
          leftColumn: { ...slide.leftColumn, content: keep(slide.leftColumn?.content) ?? [] },
          rightColumn: { ...slide.rightColumn, content: keep(slide.rightColumn?.content) ?? [] },
        };
        break;
      case "code-explainer":
        next = { ...slide, explanationPoints: keep(slide.explanationPoints) ?? [] };
        break;
      default:
        break;
    }
    if (!moved.length) return slide;
    const notes = [slide.notes?.trim(), ...moved].filter(Boolean).join("\n\n");
    return { ...next, notes };
  });
  return { ...ast, slides };
}

export function extractJson(text: string): string {
  const stripped = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  return start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;
}

export function parseAst(jsonStr: string): unknown {
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

/** Fills in a slide id when the model omitted or duplicated one — ids are used as React keys downstream. */
export function normalizeSlideIds(ast: PresentationAST): PresentationAST {
  const seen = new Set<string>();
  const slides = ast.slides.map((slide) => {
    const needsId = !slide.id || seen.has(slide.id);
    const id = needsId ? uuidv4() : slide.id;
    seen.add(id);
    return needsId ? { ...slide, id } : slide;
  });
  return { ...ast, slides };
}
