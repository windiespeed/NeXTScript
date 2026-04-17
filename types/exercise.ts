export type ExerciseConcept =
  | "data-types"
  | "variables"
  | "operators"
  | "strings"
  | "arrays"
  | "objects"
  | "control-flow"
  | "loops"
  | "functions";

export const CONCEPT_LABELS: Record<ExerciseConcept, string> = {
  "data-types":   "Data Types",
  "variables":    "Variables",
  "operators":    "Operators",
  "strings":      "Strings",
  "arrays":       "Arrays",
  "objects":      "Objects",
  "control-flow": "Control Flow",
  "loops":        "Loops",
  "functions":    "Functions",
};

export const CONCEPT_ORDER: ExerciseConcept[] = [
  "data-types", "variables", "operators", "strings",
  "arrays", "objects", "control-flow", "loops", "functions",
];

export const CONCEPT_DESCRIPTIONS: Record<ExerciseConcept, string> = {
  "data-types":   "Understand strings, numbers, booleans, null, undefined, and how to check types.",
  "variables":    "Declare, assign, and scope variables using let, const, and template literals.",
  "operators":    "Calculate and compare values using arithmetic, comparison, and logical operators.",
  "strings":      "Declare and manipulate text using string methods and template literals.",
  "arrays":       "Store and transform ordered lists of data using array methods.",
  "objects":      "Group related data and behavior into key-value structures.",
  "control-flow": "Control program execution with if/else, switch, and conditional logic.",
  "loops":        "Repeat actions using for, while, for...of, and for...in loops.",
  "functions":    "Write reusable blocks, understand parameters, return values, and callbacks.",
};

export type ExerciseLanguage = "javascript" | "python" | "html-css";
export type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";
export type ExerciseType = "exercise" | "challenge";

export interface ExerciseTest {
  id: string;
  description: string;
  code: string; // assertion code run in sandbox harness
}

export interface Exercise {
  id: string;
  userId: string;
  title: string;
  description: string;
  language: ExerciseLanguage;
  concept: ExerciseConcept;
  difficulty: ExerciseDifficulty;
  type: ExerciseType;
  order: number;           // sort order within concept
  starterCode: string;
  tests: ExerciseTest[];
  hints: string[];
  solution: string;
  lessonId?: string;
  courseId?: string;
  isSeeded?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExerciseInput = Omit<Exercise, "id" | "userId" | "createdAt" | "updatedAt">;
