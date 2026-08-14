import type { ProgressMode } from "./class";
import type { ExerciseConcept } from "./exercise";
import type { SectionDef } from "./section";

export interface CourseSettings {
  defaultSources: string;         // URLs pre-filled in lesson Sources field (one per line)
  defaultTemplateUrl: string;     // Google Slides template URL for generation
  /** Notes to Slides theme id (lib/themes.ts) used when generating for this course. Absent = fixed global default (Pearl). */
  defaultThemeId?: string;
  industry: string;               // e.g. "Healthcare", "Coding", "Business"
  subject: string;                // e.g. "JavaScript", "Nursing 101"
  studentLevel: "beginner" | "intermediate" | "advanced" | "";
  // Dynamic section list (see types/section.ts) — takes precedence over `sectionLabels` below
  // once set via the Course Settings SectionsEditor. Absent/empty means "not customized yet";
  // see lib/sections.ts's resolveSections() for the fallback synthesis from `sectionLabels`.
  // Also doubles as Notes to Slides' required-topics list (every active section's label
  // becomes a mandatory slide topic) — there is no separate required-topics field.
  sections?: SectionDef[];
  /** @deprecated superseded by `sections` above — kept as a synthesis input, never migrated. */
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

export interface CourseModule {
  id: string;        // client-generated uuid
  title: string;     // e.g. "Module 1: The Basics"
  lessonIds: string[]; // ordered subset of course.lessonIds belonging to this module
  progressMode?: "sequential" | "locked" | "free";
  solutionRevealAttempts?: number | null;
}

export interface Course {
  id: string;
  userId: string;
  title: string;
  description: string;
  gradeLevel: string;   // e.g. "9th Grade", "College", "Adult Ed"
  term: string;         // e.g. "Feb 2026" (month + year, required)
  semester?: string;    // e.g. "Spring", "Fall", "Semester 1" (optional)
  settings: CourseSettings;
  lessonIds: string[];  // ordered list of lesson IDs belonging to this course
  driveFolderId?: string;
  driveFolderUrl?: string;
  driveFolderShared?: boolean; // true once the folder has been explicitly (re-)shared with all course members
  resources?: CourseResource[];
  modules?: CourseModule[];  // ordered list of modules grouping lessons within this course
  moduleId?: string;         // legacy: linked NeXTBox class id (removed after migration)
  // NeXTBox classroom fields (migrated from classes collection)
  joinCode?: string;
  studentIds?: string[];
  language?: "javascript" | "python" | "html-css";
  progressMode?: ProgressMode;
  solutionRevealAttempts?: number | null;
  assignedConcepts?: ExerciseConcept[];
  googleClassroomId?: string;
  googleClassroomName?: string;
  teacherId?: string;
  collaborators?: string[]; // co-teacher emails with edit access (owner manages this list)
  createdAt: string;
  updatedAt: string;
}

export type CourseInput = Omit<Course, "id" | "userId" | "createdAt" | "updatedAt">;
