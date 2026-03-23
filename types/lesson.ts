import type { FormQuestion } from "./form";

export interface Lesson {
  id: string;
  userId: string;          // owner's Google email — used to scope lessons per user
  title: string;
  topics: string;
  deadline: string;
  tag: string;               // short custom label shown next to the due date on cards
  status: "draft" | "generating" | "regenerating" | "done" | "error";
  folderUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;

  // Content sections (mirrors the Google Doc template structure)
  subtitle: string;              // LESSON SUBTITLE — specific topic/subject
  overview: string;              // LESSON OVERVIEW
  learningTargets: string;       // LEARNING TARGETS
  vocabulary: string;            // VOCABULARY — key terms and definitions
  warmUp: string;                // WARM-UP — 3-5 questions to open class
  slideContent: string;          // SLIDE CONTENT — blank line = new slide
  guidedLab: string;             // GUIDED LAB
  selfPaced: string;             // SELF-PACED
  submissionChecklist: string;   // SUBMISSION CHECKLIST
  checkpoint: string;            // CHECKPOINT — common problems & solutions
  industryBestPractices: string; // INDUSTRY BEST PRACTICES
  devJournalPrompt: string;      // DEVELOPMENT JOURNAL PROMPT
  rubric: string;                // RUBRIC — comprehension/objective checklist
  courseId?: string;             // ID of the course this lesson belongs to (null = standalone)
  released?: boolean;            // Whether this lesson is visible in the student view
  folder?: string;               // Optional folder name for grouping lessons on the dashboard
  sources: string;               // Reference URLs (one per line) used during generation
  studentLevel?: "beginner" | "intermediate" | "advanced"; // Target student experience level for AI generation
  quizQuestions?: FormQuestion[]; // Custom quiz questions — if set, used instead of auto-gen
  notes?: string;                 // Private instructor notes — never used in generation
  slideCount?: number;            // Number of slides to generate with AI Fill (default 10)
  overviewSlides?: boolean[];     // Per-slide flag: true = include in Overview Doc generation
  lessonType?: "lesson" | "practice" | "project" | "assessment" | "review"; // Activity classification
}

export type LessonInput = Omit<
  Lesson,
  "id" | "userId" | "status" | "folderUrl" | "errorMessage" | "createdAt" | "updatedAt"
>;
