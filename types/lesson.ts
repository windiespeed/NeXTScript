import type { FormQuestion } from "./form";

export interface Lesson {
  id: string;
  userId: string;          // owner's Google email — used to scope lessons per user
  title: string;
  topics: string;
  deadline: string;
  status: "draft" | "generating" | "regenerating" | "done" | "error";
  folderUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;

  // Content sections (mirrors the Google Doc template structure)
  subtitle: string;              // LESSON SUBTITLE — specific topic/subject
  overview: string;              // LESSON OVERVIEW
  learningTargets: string;       // LEARNING TARGETS
  warmUp: string;                // WARM-UP — 3-5 questions to open class
  slideContent: string;          // SLIDE CONTENT — blank line = new slide
  guidedLab: string;             // GUIDED LAB
  selfPaced: string;             // SELF-PACED
  submissionChecklist: string;   // SUBMISSION CHECKLIST
  checkpoint: string;            // CHECKPOINT — common problems & solutions
  industryBestPractices: string; // INDUSTRY BEST PRACTICES
  devJournalPrompt: string;      // DEVELOPMENT JOURNAL PROMPT
  rubric: string;                // RUBRIC — comprehension/objective checklist
  sources: string;               // Reference URLs (one per line) used during generation
  quizQuestions?: FormQuestion[]; // Custom quiz questions — if set, used instead of auto-gen
}

export type LessonInput = Omit<
  Lesson,
  "id" | "userId" | "status" | "folderUrl" | "errorMessage" | "createdAt" | "updatedAt"
>;
