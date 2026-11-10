/**
 * Request-body schemas for the update (PUT) routes.
 *
 * Each schema lists the fields a client may change. Unknown keys are dropped
 * (Zod's default "strip" mode), so ownership and bookkeeping fields such as
 * `id`, `userId`, `teacherId`, `createdAt` and `updatedAt` can never be written
 * through a patch, even though clients sometimes echo them back. Optional fields
 * accept null because several pages send null to clear a value.
 */
import { z } from "zod";

const str = z.string().max(200_000).nullish();
const shortStr = z.string().max(2_000).nullish();

const lessonResource = z.object({
  id: z.string().max(200),
  type: z.enum(["doc", "sheet", "slides", "form", "link", "pdf", "image", "other"]),
  label: z.string().max(2_000),
  url: z.string().max(4_000),
  driveId: z.string().max(200).optional(),
  createdAt: z.string().max(100),
});

export const lessonPatchSchema = z.object({
  title: shortStr,
  subtitle: shortStr,
  topics: str,
  deadline: shortStr,
  tag: shortStr,
  status: z.enum(["draft", "generating", "regenerating", "done", "error"]).nullish(),
  folderUrl: shortStr,
  errorMessage: str,
  overview: str,
  learningTargets: str,
  vocabulary: str,
  warmUp: str,
  slideContent: str,
  guidedLab: str,
  selfPaced: str,
  submissionChecklist: str,
  checkpoint: str,
  industryBestPractices: str,
  devJournalPrompt: str,
  rubric: str,
  courseId: shortStr,
  released: z.boolean().nullish(),
  publishedToClassroom: z.boolean().nullish(),
  folder: shortStr,
  sources: str,
  studentLevel: z.enum(["beginner", "intermediate", "advanced"]).nullish(),
  // Quiz questions and the AST have their own shape checks where they're used.
  quizQuestions: z.array(z.unknown()).max(500).nullish(),
  notes: str,
  slideCount: z.number().int().min(0).max(200).nullish(),
  overviewSlides: z.array(z.boolean()).max(500).nullish(),
  lessonType: z.enum(["lesson", "practice", "project", "assessment", "review"]).nullish(),
  resources: z.array(lessonResource).max(200).nullish(),
  overviewUrl: shortStr,
  concept: shortStr,
  progressMode: z.enum(["sequential", "locked", "free"]).nullish(),
  solutionRevealAttempts: z.number().int().min(0).max(1_000).nullish(),
  presentationAST: z.unknown().optional(),
  selectedTheme: shortStr,
  presentationStatus: z.enum(["draft", "exported"]).nullish(),
  sections: z.record(z.string(), z.string().max(200_000)).nullish(),
});

const exerciseTest = z.object({
  id: z.string().max(200),
  description: z.string().max(2_000),
  code: z.string().max(50_000),
});

export const exercisePatchSchema = z.object({
  title: shortStr,
  description: str,
  language: z.enum(["javascript", "python", "html-css"]).nullish(),
  concept: shortStr,
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).nullish(),
  type: z.enum(["exercise", "challenge"]).nullish(),
  order: z.number().nullish(),
  starterCode: str,
  tests: z.array(exerciseTest).max(200).nullish(),
  hints: z.array(z.string().max(5_000)).max(100).nullish(),
  solution: str,
  lessonId: shortStr,
  courseId: shortStr,
  isSeeded: z.boolean().nullish(),
});

export const conceptPatchSchema = z.object({
  slug: shortStr,
  label: shortStr,
  description: str,
  order: z.number().nullish(),
});

/** Drops nulls the schema let through so they don't overwrite with `undefined`. */
type Defined<T> = { [K in keyof T]: Exclude<T[K], undefined> };

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Parses a JSON body against a schema, returning a short message on failure. */
export function parsePatch<S extends z.ZodType>(schema: S, body: unknown): ParseResult<Defined<z.infer<S>>> {
  // Zod leaves absent optional keys out entirely, so nothing is undefined here.
  return parseBody(schema, body) as ParseResult<Defined<z.infer<S>>>;
}

/** Like parsePatch, but keeps the schema's own output type (for request bodies whose
 * transforms deliberately produce undefined, such as the ingest routes below). */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown): ParseResult<z.infer<S>> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    return { ok: false, error: `Invalid request${where}: ${issue?.message ?? "bad input"}` };
  }
  return { ok: true, data: result.data };
}

/** Fields no client may set through a generic patch on courses and projects. */
export const PROTECTED_FIELDS = ["id", "userId", "teacherId", "createdAt", "updatedAt"] as const;

/** Removes protected fields from a plain-object patch. Rejects anything that isn't a plain object. */
export function stripProtected(body: unknown, extra: readonly string[] = []): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const out: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const k of [...PROTECTED_FIELDS, ...extra]) delete out[k];
  return out;
}

/** Trims a string and turns blank into undefined, so optional prompt context is either real text or absent. */
const optionalText = (max: number) =>
  z.string().max(max).nullish().transform(v => (v && v.trim() ? v.trim() : undefined));

/**
 * POST /api/ai/ingest — the hybrid Notes to Slides request (types/ingest.ts). Only
 * `courseConfig.courseId` is trusted from the skeleton: the route re-reads the course for its
 * anchors and theme, so the anchors the browser echoes are accepted but never used.
 */
export const hybridIngestSchema = z.object({
  courseConfig: z.object({
    courseId: z.string().min(1, "Select a course first — its sections are the deck's skeleton.").max(200),
    anchors: z.array(z.object({ id: z.string().max(200), label: z.string().max(2_000) })).max(100).optional(),
    themeId: z.string().max(100).nullish(),
  }),
  rawNotes: z.string().max(200_000),
  model: z.string().max(100).nullish(),
  targetAudience: optionalText(2_000),
  // Out-of-range counts are clamped rather than rejected — it's only guidance for the model.
  slideCount: z.number().int().nullish().transform(n => (typeof n === "number" ? Math.min(30, Math.max(1, n)) : undefined)),
  studentLevel: z.enum(["beginner", "intermediate", "advanced"]).nullish().transform(v => v ?? undefined),
  lessonTitle: optionalText(2_000),
  lessonSubtitle: optionalText(2_000),
  topics: optionalText(20_000),
  sources: optionalText(20_000),
});

/** POST /api/ai/ingest/export — the deck itself is checked separately by assertValidAst. */
export const ingestExportSchema = z.object({
  ast: z.unknown(),
  lessonId: z.string().max(200).nullish(),
  courseId: z.string().max(200).nullish(),
});
