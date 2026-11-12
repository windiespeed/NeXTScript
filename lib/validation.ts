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
import { AI_MODELS } from "@/lib/aiModels";

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
  slideNotes: z.string().max(200_000).nullish(),
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
  /** Draw the deck onto the course's Google Slides template, when it has one. Default true. */
  useTemplate: z.boolean().optional(),
});

// ---------------------------------------------------------------------------------------------
// Create routes, course/project patches, and the smaller write routes (re-audit R3).
// Fields the server owns (driveFolderId/Url/Shared, studentIds, teacherId, a project's url,
// type and status) are left out, so the strip mode drops them.
// ---------------------------------------------------------------------------------------------

const idStr = z.string().max(200);
const ids = (max = 2_000) => z.array(idStr).max(max);
const label = z.string().max(2_000);
const required = (what: string, max = 2_000) => z.string().trim().min(1, `${what} is required.`).max(max);

/**
 * A link a teacher pasted. Older saved links don't always have a scheme ("drive.google.com/…"),
 * so only script and data URLs are refused rather than demanding http(s).
 */
export const safeUrl = z
  .string()
  .trim()
  .max(4_000)
  .refine(u => !/^(javascript|data|vbscript|file):/i.test(u.replace(/[\s\u0000-\u001f]/g, "")), "That link type isn't allowed.");

const sectionDef = z.object({
  id: idStr,
  label,
  position: z.enum(["before-slides", "after-slides"]).optional(),
  includeInOverviewDoc: z.boolean().default(false),
  includeInQuizContext: z.boolean().optional(),
  skipIfEmpty: z.boolean().optional(),
  slideAnchor: z.boolean().optional(),
  hint: z.string().max(5_000).optional(),
  rows: z.number().int().min(1).max(100).optional(),
});
const sectionList = z.array(sectionDef).max(100);
const sectionLabels = z.record(z.string().max(100), label);

const courseSettings = z
  .object({
    defaultSources: z.string().max(20_000),
    defaultTemplateUrl: z.string().max(4_000),
    defaultThemeId: z.string().max(100).nullish(),
    industry: label,
    subject: label,
    studentLevel: z.enum(["beginner", "intermediate", "advanced", ""]),
    sections: sectionList,
    sectionLabels,
  })
  .partial();

const progressMode = z.enum(["sequential", "locked", "free"]);
const language = z.enum(["javascript", "python", "html-css"]);
const revealAttempts = z.number().int().min(0).max(1_000).nullish();

const courseResource = z.object({ id: idStr, label, url: safeUrl });
const courseModule = z.object({
  id: idStr,
  title: label,
  lessonIds: ids(),
  progressMode: progressMode.nullish(),
  solutionRevealAttempts: revealAttempts,
});

const courseFields = {
  title: label,
  description: z.string().max(20_000),
  gradeLevel: label,
  term: label,
  semester: label.nullish(),
  settings: courseSettings,
  lessonIds: ids(),
  resources: z.array(courseResource).max(200),
  modules: z.array(courseModule).max(200),
  moduleId: idStr.nullish(),
  joinCode: z.string().max(50).nullish(),
  language: language.nullish(),
  progressMode: progressMode.nullish(),
  solutionRevealAttempts: revealAttempts,
  assignedConcepts: z.array(idStr).max(500),
  googleClassroomId: idStr.nullish(),
  googleClassroomName: label.nullish(),
};

/** PUT /api/courses/[id]. Collaborators are lowercased emails; only the owner may change them (checked in the route). */
export const coursePatchSchema = z
  .object({
    ...courseFields,
    collaborators: z.array(z.string().trim().toLowerCase().email("Enter a valid email address.").max(320)).max(100).nullish(),
  })
  .partial();

/** PUT /api/modules/[id], the legacy alias: same as a course patch, minus collaborators. */
export const legacyModulePatchSchema = z.object(courseFields).partial();

/** POST /api/courses. Collaborators are added afterwards in Course Settings, which also shares the Drive folder. */
export const courseCreateSchema = z.object(courseFields).partial().extend({ title: required("Title") });

/** POST /api/modules, the legacy create (takes `name` or `title`). */
export const legacyModuleCreateSchema = z.object({
  name: label.nullish(),
  title: label.nullish(),
  language: language.nullish(),
  progressMode: progressMode.nullish(),
  solutionRevealAttempts: revealAttempts,
  assignedConcepts: z.array(idStr).max(500).nullish(),
});

/** POST /api/lessons. The server sets status, folderUrl and errorMessage. */
export const lessonCreateSchema = lessonPatchSchema
  .omit({ status: true, folderUrl: true, errorMessage: true })
  .extend({ title: required("Title"), courseId: required("Course", 200) });

/** POST /api/exercises. */
export const exerciseCreateSchema = exercisePatchSchema.extend({
  title: required("Title"),
  courseId: required("courseId", 200),
});

/** POST /api/concepts (`classId` is the legacy name for `courseId`). */
export const conceptCreateSchema = conceptPatchSchema.extend({
  slug: required("Slug"),
  label: required("Label"),
  courseId: idStr.nullish(),
  classId: idStr.nullish(),
});

const formQuestion = z.object({
  id: idStr,
  type: z.enum(["multiple_choice", "short_answer", "paragraph"]),
  text: z.string().max(10_000),
  options: z.array(z.string().max(2_000)).max(50).default([]),
  correctAnswer: z.string().max(2_000).default(""),
  required: z.boolean().default(true),
});
const formQuestions = z.array(formQuestion).max(500);

/** POST /api/quizzes: a quiz draft. */
export const quizCreateSchema = z.object({
  title: required("Quiz title"),
  lessonIds: ids(500).nullish(),
  moduleId: idStr.nullish(),
  courseId: required("Course", 200),
  questions: formQuestions.min(1, "Add at least one question."),
});

/** PUT /api/projects/[id]. The url, type and status are written only by the generate routes. */
export const projectPatchSchema = z
  .object({
    title: label,
    subtitle: label.nullish(),
    description: z.string().max(20_000).nullish(),
    lessonId: idStr.nullish(),
    lessonIds: ids(500),
    moduleId: idStr.nullish(),
    courseId: idStr.nullish(),
    questions: formQuestions,
  })
  .partial();

/** POST /api/lessons/[id]/resources. */
export const lessonResourceCreateSchema = z.object({
  label: required("label"),
  url: safeUrl.pipe(z.string().min(1, "url is required.")),
  type: z.enum(["doc", "sheet", "slides", "form", "link", "pdf", "image", "other"]).default("link"),
});

/** POST /api/lessons/[id]/blank-doc. */
export const blankDocSchema = z.object({
  name: required("name", 500),
  docType: z.enum(["doc", "sheet", "slides"], "Invalid docType."),
});

/** POST /api/lessons/[id]/overview-doc. */
export const overviewDocSchema = z.object({
  deckIds: ids(100).default([]),
  quizIds: ids(100).default([]),
});

/** POST /api/classroom/push. */
export const classroomPushSchema = z.object({
  lessonIds: ids(500).min(1, "No lessons specified."),
  courseId: required("courseId", 200),
  moduleName: label.nullish(),
});

/** POST /api/exercises/seed and /api/concepts/seed. */
export const seedSchema = z.object({ courseId: idStr.nullish(), classId: idStr.nullish() });

const apiKey = z.string().trim().min(1, "Invalid key.").max(500, "Invalid key.");

/** PUT /api/user/settings. Only the keys sent are saved; null clears a text field to "". */
export const userSettingsPatchSchema = z
  .object({
    anthropicKey: apiKey,
    geminiKey: apiKey,
    folders: z.array(label).max(500).nullable(),
    lessonOrder: ids(5_000).nullable(),
    industry: label.nullable(),
    subject: label.nullable(),
    sectionLabels: sectionLabels.nullable(),
    sections: sectionList.nullable(),
    // Profile → Advanced. "auto" (or null) = the default model for whichever key is saved.
    preferredAiModel: z.enum(["auto", ...AI_MODELS.map(m => m.id)] as [string, ...string[]]).nullable(),
  })
  .partial();

/** POST /api/ai/lesson: the lesson as the form holds it. Only its text is read. */
export const aiLessonSchema = lessonPatchSchema;

/** POST /api/ai/quiz. */
export const aiQuizSchema = z.object({
  lesson: lessonPatchSchema,
  mcCount: z.number().int().nullish(),
  saCount: z.number().int().nullish(),
  courseId: idStr.nullish(),
});

/** Reads a JSON request body and parses it. An empty or malformed body is a 400, or `{}` with emptyOk. */
/** The request's JSON body, or undefined when it isn't valid JSON (the schema then rejects it with a 400). */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export async function readBody<S extends z.ZodType>(
  req: Request,
  schema: S,
  opts: { emptyOk?: boolean } = {},
): Promise<ParseResult<Defined<z.infer<S>>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    if (!opts.emptyOk) return { ok: false, error: "Invalid request: expected JSON." };
    body = {};
  }
  return parsePatch(schema, body);
}
