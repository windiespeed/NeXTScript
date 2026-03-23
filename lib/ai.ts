import Anthropic from "@anthropic-ai/sdk";
import type { LessonInput } from "@/types/lesson";
import type { FormQuestion } from "@/types/form";
import { DEFAULT_SECTION_LABELS, type SectionLabels } from "@/lib/userSettings";

interface CurriculumContext {
  industry?: string;
  subject?: string;
  labels?: SectionLabels;
}

type AiFillResult = Pick<
  LessonInput,
  | "overview"
  | "learningTargets"
  | "vocabulary"
  | "warmUp"
  | "guidedLab"
  | "selfPaced"
  | "submissionChecklist"
  | "checkpoint"
  | "industryBestPractices"
  | "devJournalPrompt"
  | "rubric"
> & {
  slides: { title: string; body: string }[];
};

const LEVEL_INSTRUCTIONS: Record<string, string> = {
  beginner: "The target audience is complete beginners with NO prior coding experience (typically high school students). Use plain, simple language. Avoid jargon — if you must use a technical term, define it immediately. Break every step down to the smallest possible action. Assume the student has never opened a code editor before.",
  intermediate: "The target audience has some coding experience (completed at least one introductory course). Use standard technical language, reference concepts they likely know (variables, functions, loops), and keep explanations moderately detailed.",
  advanced: "The target audience is experienced developers. Use precise technical terminology, assume familiarity with common tools and patterns, and focus on depth, edge cases, and industry best practices.",
};

export async function fillLesson(
  apiKey: string,
  lesson: Partial<LessonInput>,
  ctx: CurriculumContext = {},
  slideCount = 10
): Promise<AiFillResult> {
  const client = new Anthropic({ apiKey });

  const level = lesson.studentLevel ?? "beginner";
  const levelInstruction = LEVEL_INSTRUCTIONS[level] ?? LEVEL_INSTRUCTIONS.beginner;
  const labels = ctx.labels ?? DEFAULT_SECTION_LABELS;
  const industryLine = ctx.industry ? `Industry: ${ctx.industry}` : "";
  const subjectLine = ctx.subject ? `Subject Area: ${ctx.subject}` : "";
  const programDesc = [ctx.industry, ctx.subject].filter(Boolean).join(" — ") || "an educational program";

  const prompt = `You are a curriculum designer for ${programDesc}. Generate content for a lesson with the following details:

Title: ${lesson.title || "Untitled"}
Subtitle: ${lesson.subtitle || ""}
Topics: ${lesson.topics || ""}
Sources: ${lesson.sources || ""}
Student Level: ${level}
${industryLine}
${subjectLine}

IMPORTANT — Student Level Guidance: ${levelInstruction}

Generate each of the following sections. Tailor ALL content to the student level and program above.

Return ONLY a valid JSON object with these exact keys (no markdown, no explanation):
{
  "overview": "3-4 sentence paragraph overview of the lesson",
  "learningTargets": "5-7 bullet points (one per line, starting with •) of specific measurable objectives",
  "vocabulary": "8-12 key terms with concise definitions, formatted as 'Term: Definition' (one per line)",
  "warmUp": "3-5 questions (numbered) to engage students at the start of class — label this section '${labels.warmUp}'",
  "slides": [
    { "title": "Slide title", "body": "Slide content — write as plain concise sentences or relevant examples. Do NOT use bullet characters (•, -, *) or any list symbols. Wrap inline code in backticks." }
  ],
  "guidedLab": "Step-by-step instructor-led exercise (numbered steps) — label this section '${labels.guidedLab}'",
  "selfPaced": "Step-by-step independent exercise (numbered steps) — label this section '${labels.selfPaced}'",
  "submissionChecklist": "Specific requirements students must meet (bullet points starting with •) — label this section '${labels.submissionChecklist}'",
  "checkpoint": "3-5 common problems students may face with solutions — label this section '${labels.checkpoint}'",
  "industryBestPractices": "3-5 standards and best practices for this topic (bullet points) — label this section '${labels.industryBestPractices}'",
  "devJournalPrompt": "3-5 specific reflection questions — label this section '${labels.devJournalPrompt}'",
  "rubric": "Comprehension and objective checklist (bullet points with point values) — label this section '${labels.rubric}'"
}

For "slides": generate exactly ${slideCount} slides that cover the lesson's main concepts in a logical teaching sequence. Each slide should have a concise title and a body with 3-5 plain-text sentences or a brief example. Do NOT use bullet characters (•, -, *) or list symbols anywhere in slide bodies. The first slide should be an intro/agenda slide.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  // Strip markdown fences, then extract the outermost {...} block
  const stripped = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  const jsonStr = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;
  try {
    return JSON.parse(jsonStr) as AiFillResult;
  } catch {
    // AI sometimes returns literal newlines inside JSON strings — normalize and retry
    const cleaned = jsonStr.replace(/:\s*"([\s\S]*?)"\s*([,}])/g, (_, val, tail) =>
      `: "${val.replace(/\n/g, "\\n").replace(/\r/g, "").replace(/"/g, '\\"')}"${tail}`
    );
    try {
      return JSON.parse(cleaned) as AiFillResult;
    } catch {
      throw new Error(`AI Fill failed to generate valid content. Please make sure the lesson has a title and try again.`);
    }
  }
}

export async function generateQuizQuestions(
  apiKey: string,
  lesson: Partial<LessonInput>,
  ctx: CurriculumContext = {},
  mcCount = 8,
  saCount = 2
): Promise<FormQuestion[]> {
  const client = new Anthropic({ apiKey });
  const numQuestions = mcCount + saCount;

  const level = lesson.studentLevel ?? "beginner";
  const levelInstruction = LEVEL_INSTRUCTIONS[level] ?? LEVEL_INSTRUCTIONS.beginner;
  const programDesc = [ctx.industry, ctx.subject].filter(Boolean).join(" — ") || "an educational program";

  // Build content block — works with just topics if full lesson content isn't available
  const hasFullContent = !!(lesson.learningTargets || lesson.overview || lesson.slideContent);
  const contentBlock = hasFullContent
    ? `--- LESSON CONTENT ---
Learning Targets:
${lesson.learningTargets || ""}

Vocabulary:
${lesson.vocabulary || ""}

Overview:
${lesson.overview || ""}

Slide Content:
${lesson.slideContent || ""}

Guided Lab:
${lesson.guidedLab || ""}

Industry Best Practices:
${lesson.industryBestPractices || ""}
--- END LESSON CONTENT ---

Generate questions drawn directly from the lesson content above.`
    : `Generate questions based on the following topics: ${lesson.topics || lesson.title || "the subject matter"}.`;

  const prompt = `You are a curriculum designer for ${programDesc}. Generate a quiz for the following lesson.

Title: ${lesson.title || "Untitled"}
Subtitle: ${lesson.subtitle || ""}
Topics: ${lesson.topics || ""}
Student Level: ${level}

IMPORTANT — Student Level Guidance: ${levelInstruction}

${contentBlock}

Generate exactly ${numQuestions} quiz questions: ${mcCount} multiple choice and ${saCount} short answer, in that order.
For multiple choice, always include exactly 4 options and specify the correct answer.
For short answer, leave correctAnswer as an empty string.

Return ONLY a valid JSON array with no markdown, no explanation:
[
  {
    "type": "multiple_choice",
    "text": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "required": true
  },
  {
    "type": "short_answer",
    "text": "Question text here?",
    "options": [],
    "correctAnswer": "",
    "required": true
  }
]`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: Math.max(2048, numQuestions * 300),
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  const jsonStr = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  try {
    return JSON.parse(jsonStr) as FormQuestion[];
  } catch {
    return [];
  }
}
