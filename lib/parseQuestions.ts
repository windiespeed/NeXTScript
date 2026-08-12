import type { FormQuestion, QuestionType } from "@/types/form";

/**
 * Parses pasted plain text into quiz questions. Each question is a blank-line-separated
 * block (or, for a paste with no blank lines at all, a run of "1. ..."-numbered lines).
 * A block's first line is the question text; subsequent lines matching "a)", "-", "*", etc.
 * become multiple-choice options. Mark the correct option with a trailing or leading "*".
 * Blocks with fewer than 2 detected options become short-answer questions.
 */
export function parsePastedQuestions(raw: string): FormQuestion[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  let blocks = text.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
  if (blocks.length <= 1) {
    const numbered = text.split(/\n(?=\s*\d+[.)]\s)/).map(b => b.trim()).filter(Boolean);
    if (numbered.length > 1) blocks = numbered;
  }

  return blocks
    .map((block, i) => parseBlock(block, i))
    .filter((q): q is FormQuestion => q !== null);
}

const OPTION_LINE = /^(?:[a-zA-Z][.)]|[-*•])\s*(.+)$/;

function parseBlock(block: string, index: number): FormQuestion | null {
  const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const questionText = lines[0].replace(/^\d+[.)]\s*/, "").trim();
  if (!questionText) return null;

  const options: string[] = [];
  let correctAnswer = "";
  for (const line of lines.slice(1)) {
    const match = line.match(OPTION_LINE);
    if (!match) continue;
    let optionText = match[1].trim();
    const isCorrect = /^\*|\*$/.test(optionText);
    optionText = optionText.replace(/^\*+\s*/, "").replace(/\s*\*+$/, "").trim();
    if (!optionText) continue;
    options.push(optionText);
    if (isCorrect) correctAnswer = optionText;
  }

  const type: QuestionType = options.length >= 2 ? "multiple_choice" : "short_answer";
  return {
    id: `imp_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    text: questionText,
    options: type === "multiple_choice" ? options : ["", ""],
    correctAnswer,
    required: true,
  };
}
