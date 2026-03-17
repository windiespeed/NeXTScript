import Anthropic from "@anthropic-ai/sdk";
import type { LessonInput } from "@/types/lesson";

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

export async function fillLesson(
  apiKey: string,
  lesson: Partial<LessonInput>
): Promise<AiFillResult> {
  const client = new Anthropic({ apiKey });

  const prompt = `You are a curriculum designer for a coding bootcamp. Generate content for a lesson with the following details:

Title: ${lesson.title || "Untitled"}
Subtitle: ${lesson.subtitle || ""}
Topics: ${lesson.topics || ""}
Sources: ${lesson.sources || ""}

Generate each of the following sections. Be specific, practical, and appropriate for high school or early college students learning to code.

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

For "slides": generate 5-8 slides that cover the lesson's main concepts in a logical teaching sequence. Each slide should have a concise title and a body with 3-5 short bullet points or a brief code example. The first slide should be an intro/agenda slide.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  // Strip markdown code fences if present
  const jsonStr = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(jsonStr) as AiFillResult;
}
