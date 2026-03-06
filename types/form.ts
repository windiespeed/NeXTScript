export type QuestionType = "multiple_choice" | "short_answer" | "paragraph";

export interface FormQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];        // used for multiple_choice
  correctAnswer: string;    // used for multiple_choice grading (optional, leave "" to skip)
  required: boolean;
}

export function emptyQuestion(id: string): FormQuestion {
  return { id, type: "multiple_choice", text: "", options: ["", ""], correctAnswer: "", required: true };
}
