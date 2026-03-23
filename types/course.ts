export interface CourseSettings {
  defaultSources: string;         // URLs pre-filled in lesson Sources field (one per line)
  defaultTemplateUrl: string;     // Google Slides template URL for generation
  industry: string;               // e.g. "Healthcare", "Coding", "Business"
  subject: string;                // e.g. "JavaScript", "Nursing 101"
  studentLevel: "beginner" | "intermediate" | "advanced" | "";
  sectionLabels: {
    lessonOverview: string;
    learningTargets: string;
    vocabulary: string;
    warmUp: string;
    guidedLab: string;
    selfPaced: string;
    submissionChecklist: string;
    checkpoint: string;
    industryBestPractices: string;
    devJournalPrompt: string;
    rubric: string;
  };
}

export const DEFAULT_COURSE_SETTINGS: CourseSettings = {
  defaultSources: "",
  defaultTemplateUrl: "",
  industry: "",
  subject: "",
  studentLevel: "",
  sectionLabels: {
    lessonOverview: "Lesson Overview",
    learningTargets: "Learning Targets",
    vocabulary: "Vocabulary",
    warmUp: "Opening Activity",
    guidedLab: "Guided Activity",
    selfPaced: "Independent Activity",
    submissionChecklist: "Requirements Checklist",
    checkpoint: "Common Problems / FAQ",
    industryBestPractices: "Best Practices",
    devJournalPrompt: "Reflection Journal",
    rubric: "Assessment / Rubric",
  },
};

export interface CourseResource {
  id: string;     // client-generated uuid
  label: string;  // e.g. "Syllabus", "Reference Sheet"
  url: string;    // Google Drive or any URL
}

export interface Course {
  id: string;
  userId: string;
  title: string;
  description: string;
  gradeLevel: string;   // e.g. "9th Grade", "College", "Adult Ed"
  term: string;         // e.g. "Spring 2026", "Q1"
  settings: CourseSettings;
  lessonIds: string[];  // ordered list of lesson IDs belonging to this course
  driveFolderId?: string;
  driveFolderUrl?: string;
  resources?: CourseResource[];
  createdAt: string;
  updatedAt: string;
}

export type CourseInput = Omit<Course, "id" | "userId" | "createdAt" | "updatedAt">;
