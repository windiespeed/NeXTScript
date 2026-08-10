import Anthropic from "@anthropic-ai/sdk";
import type { LessonInput } from "@/types/lesson";
import type { FormQuestion } from "@/types/form";
import { STUDENT_LEVEL_GUIDANCE } from "@/lib/studentLevel";
import { getSectionContent } from "@/lib/sections";
import { DEFAULT_SECTIONS, BUILTIN_AI_INSTRUCTIONS, isBuiltinId, type SectionDef } from "@/types/section";

interface CurriculumContext {
  industry?: string;
  subject?: string;
  sections?: SectionDef[];
}

interface AiFillResult {
  sections: Record<string, string>;
  slides: { title: string; body: string }[];
}

export async function fillLesson(
  apiKey: string,
  lesson: Partial<LessonInput>,
  ctx: CurriculumContext = {},
  slideCount = 10
): Promise<AiFillResult> {
  const client = new Anthropic({ apiKey });

  const level = lesson.studentLevel ?? "beginner";
  const levelInstruction = STUDENT_LEVEL_GUIDANCE[level] ?? STUDENT_LEVEL_GUIDANCE.beginner;
  const sections = ctx.sections ?? DEFAULT_SECTIONS;
  const industryLine = ctx.industry ? `Industry: ${ctx.industry}` : "";
  const subjectLine = ctx.subject ? `Subject Area: ${ctx.subject}` : "";
  const programDesc = [ctx.industry, ctx.subject].filter(Boolean).join(" — ") || "an educational program";

  const sectionSchemaLines = sections
    .map(s => {
      const instruction = isBuiltinId(s.id)
        ? BUILTIN_AI_INSTRUCTIONS[s.id]
        : `Generate helpful content for the "${s.label}" section`;
      return `  "${s.id}": "${instruction} — label this section '${s.label}'"`;
    })
    .join(",\n");

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
${sectionSchemaLines},
  "slides": [
    { "title": "Slide title", "body": "Slide content — write as plain concise sentences or relevant examples. Do NOT use bullet characters (•, -, *) or any list symbols. Wrap inline code in backticks." }
  ]
}

For "slides": generate exactly ${slideCount} slides that cover the lesson's main concepts in a logical teaching sequence. Each slide should have a concise title and a body with 3-5 plain-text sentences or a brief example. Do NOT use bullet characters (•, -, *) or list symbols anywhere in slide bodies. The first slide should be an intro/agenda slide.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  // Strip markdown fences, then extract the outermost {...} block
  const stripped = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  const jsonStr = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // AI sometimes returns literal newlines inside JSON strings — normalize and retry
    const cleaned = jsonStr.replace(/:\s*"([\s\S]*?)"\s*([,}])/g, (_, val, tail) =>
      `: "${val.replace(/\n/g, "\\n").replace(/\r/g, "").replace(/"/g, '\\"')}"${tail}`
    );
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`AI Fill failed to generate valid content. Please make sure the lesson has a title and try again.`);
    }
  }

  const { slides, ...sectionValues } = parsed;
  // Only keep keys that match a known section id — discards anything the model hallucinated.
  const knownIds = new Set(sections.map(s => s.id));
  const resultSections: Record<string, string> = {};
  for (const [key, value] of Object.entries(sectionValues)) {
    if (knownIds.has(key) && typeof value === "string") resultSections[key] = value;
  }

  return {
    sections: resultSections,
    slides: Array.isArray(slides) ? (slides as { title: string; body: string }[]) : [],
  };
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
  const levelInstruction = STUDENT_LEVEL_GUIDANCE[level] ?? STUDENT_LEVEL_GUIDANCE.beginner;
  const programDesc = [ctx.industry, ctx.subject].filter(Boolean).join(" — ") || "an educational program";

  const quizSections = (ctx.sections ?? DEFAULT_SECTIONS).filter(s => s.includeInQuizContext !== false);
  const sectionContentLines = quizSections.map(s => `${s.label}:\n${getSectionContent(lesson, s.id)}`);

  // Build content block — works with just topics if full lesson content isn't available
  const hasFullContent = quizSections.some(s => getSectionContent(lesson, s.id)) || !!lesson.slideContent;
  const contentBlock = hasFullContent
    ? `--- LESSON CONTENT ---
${sectionContentLines.join("\n\n")}

Slide Content:
${lesson.slideContent || ""}
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
