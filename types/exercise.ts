// concept is now a free-form string slug (e.g. "variables", "oop", "python-basics")
export type ExerciseConcept = string;

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
