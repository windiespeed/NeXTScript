import Anthropic from "@anthropic-ai/sdk";
import type { LessonInput } from "@/types/lesson";
import type { FormQuestion } from "@/types/form";

type AiFillResult = Pick<
  LessonInput,
  | "overview"
  | "learningTargets"
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
  lesson: Partial<LessonInput>
): Promise<AiFillResult> {
  const client = new Anthropic({ apiKey });

  const level = lesson.studentLevel ?? "beginner";
  const levelInstruction = LEVEL_INSTRUCTIONS[level] ?? LEVEL_INSTRUCTIONS.beginner;

  const prompt = `You are a curriculum designer for a coding bootcamp. Generate content for a lesson with the following details:

Title: ${lesson.title || "Untitled"}
Subtitle: ${lesson.subtitle || ""}
Topics: ${lesson.topics || ""}
Sources: ${lesson.sources || ""}
Student Level: ${level}

IMPORTANT — Student Level Guidance: ${levelInstruction}

Generate each of the following sections. Tailor ALL content to the student level above.

Return ONLY a valid JSON object with these exact keys (no markdown, no explanation):
{
  "overview": "3-4 sentence paragraph overview of the lesson",
  "learningTargets": "5-7 bullet points (one per line, starting with •) of specific measurable objectives",
  "warmUp": "3-5 questions (numbered) to engage students at the start of class",
  "slides": [
    { "title": "Slide title", "body": "Slide content — use short bullet points or code snippets. Wrap inline code in backticks." }
  ],
  "guidedLab": "Step-by-step instructor-led exercise (numbered steps, include file/folder naming)",
  "selfPaced": "Step-by-step independent exercise (numbered steps, include file/folder naming)",
  "submissionChecklist": "Specific requirements students must meet (bullet points starting with •)",
  "checkpoint": "3-5 common problems students may face with solutions",
  "industryBestPractices": "3-5 industry standards and best practices for this topic (bullet points)",
  "devJournalPrompt": "3-5 specific reflection questions for a development journal",
  "rubric": "Comprehension and objective checklist for TAs (bullet points with point values)"
}

For "slides": generate 10-12 slides that cover the lesson's main concepts in a logical teaching sequence. Each slide should have a concise title and a body with 3-5 short bullet points or a brief code example. The first slide should be an intro/agenda slide.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonStr = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  try {
    return JSON.parse(jsonStr) as AiFillResult;
  } catch {
    throw new Error(`AI returned invalid JSON. Stop reason: ${message.stop_reason}. Response preview: ${jsonStr.slice(0, 200)}`);
  }
}

export async function generateQuizQuestions(
  apiKey: string,
  lesson: Partial<LessonInput>
): Promise<FormQuestion[]> {
  const client = new Anthropic({ apiKey });

  const level = lesson.studentLevel ?? "beginner";
  const levelInstruction = LEVEL_INSTRUCTIONS[level] ?? LEVEL_INSTRUCTIONS.beginner;

  const prompt = `You are a curriculum designer for a coding bootcamp. Generate a quiz based strictly on the lesson content provided below.

Title: ${lesson.title || "Untitled"}
Subtitle: ${lesson.subtitle || ""}
Topics: ${lesson.topics || ""}
Student Level: ${level}

IMPORTANT — Student Level Guidance: ${levelInstruction}

--- LESSON CONTENT ---
Learning Targets:
${lesson.learningTargets || ""}

Overview:
${lesson.overview || ""}

Warm-Up:
${lesson.warmUp || ""}

Slide Content:
${lesson.slideContent || ""}

Guided Lab:
${lesson.guidedLab || ""}

Self-Paced:
${lesson.selfPaced || ""}

Checkpoint (Common Problems):
${lesson.checkpoint || ""}

Industry Best Practices:
${lesson.industryBestPractices || ""}

Rubric:
${lesson.rubric || ""}
--- END LESSON CONTENT ---

Generate exactly 10 quiz questions drawn directly from the lesson content above — not general knowledge about the topic.
8 must be multiple choice and 2 must be short answer, in that order (multiple choice first, then short answer).
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
    max_tokens: 3072,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  const jsonStr = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(jsonStr) as FormQuestion[];
}
