import Anthropic from "@anthropic-ai/sdk";
import type { Lesson } from "@/types/lesson";
import type { FormQuestion } from "@/types/form";

/**
 * Generate quiz questions for a lesson using Claude.
 * Returns 10 multiple choice + 2 short answer questions.
 * Falls back to an empty array if the API key is missing or generation fails.
 */
export async function generateQuizQuestions(lesson: Lesson): Promise<FormQuestion[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are a curriculum developer creating a quiz for a coding bootcamp lesson.

Lesson title: ${lesson.title}
${lesson.subtitle ? `Subtitle: ${lesson.subtitle}` : ""}
${lesson.learningTargets ? `Learning targets:\n${lesson.learningTargets}` : ""}
${lesson.rubric ? `Rubric:\n${lesson.rubric}` : ""}
${lesson.guidedLab ? `Guided lab:\n${lesson.guidedLab}` : ""}
${lesson.industryBestPractices ? `Industry best practices:\n${lesson.industryBestPractices}` : ""}

Generate exactly 10 multiple choice questions followed by 2 short answer questions for this lesson.
Each multiple choice question must have exactly 4 distinct answer options with exactly one correct answer.
Questions should be specific, measurable, and directly tied to the lesson content.

Return ONLY a valid JSON array — no markdown, no explanation:

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
    "text": "Reflection or explanation question here?",
    "options": [],
    "correctAnswer": "",
    "required": true
  }
]`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const raw: any[] = JSON.parse(jsonMatch[0]);
    return raw.map((q, i) => ({
      id: `ai_q_${i}`,
      type: q.type === "short_answer" ? "short_answer" : "multiple_choice",
      text: String(q.text ?? ""),
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      correctAnswer: String(q.correctAnswer ?? ""),
      required: q.required !== false,
    }));
  } catch {
    return [];
  }
}
