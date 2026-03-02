export interface Lesson {
  id: string;
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
  taChecklist: string;           // TA CHECKLIST — comprehension/objective checklist
  sources: string;               // Reference URLs (one per line) used during generation
}

export type LessonInput = Omit<
  Lesson,
  "id" | "status" | "folderUrl" | "errorMessage" | "createdAt" | "updatedAt"
>;
