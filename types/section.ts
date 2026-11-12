/**
 * Dynamic lesson content sections — replaces the formerly-fixed 11 named Lesson fields
 * (vocabulary, warmUp, guidedLab, ...) with a course/user-configurable ordered list.
 *
 * Legacy documents (no `sections` array anywhere in the chain) are read via a synthesis
 * layer in lib/sections.ts, not migrated — see that file for the read-time fallback logic.
 */
export interface SectionDef {
  id: string;                     // stable id — a BuiltinSectionId, or "s_<uuid>" for custom sections
  label: string;                  // display label shown in the lesson editor and generated docs/slides
  position?: "before-slides" | "after-slides"; // where it renders in LessonForm / the Slide Deck — default "after-slides"
  includeInOverviewDoc: boolean;  // course-level toggle: does this section's content appear in the Overview Doc body?
  includeInQuizContext?: boolean; // does this section's content feed AI quiz generation? default true
  skipIfEmpty?: boolean;          // Read only by the retired Classic Slides generator; kept so saved section settings still load
  /** Notes to Slides: is this section a locked slide heading (anchor)? Absent = the builtin's
   * default from DEFAULT_SECTIONS, or true for a custom section — see isSlideAnchor(). */
  slideAnchor?: boolean;
  hint?: string;                  // LessonForm helper text
  rows?: number;                  // LessonForm textarea size
}

export const BUILTIN_SECTION_IDS = [
  "lessonOverview",
  "learningTargets",
  "vocabulary",
  "warmUp",
  "guidedLab",
  "selfPaced",
  "submissionChecklist",
  "checkpoint",
  "industryBestPractices",
  "devJournalPrompt",
  "rubric",
] as const;

export type BuiltinSectionId = typeof BUILTIN_SECTION_IDS[number];

export function isBuiltinId(id: string): id is BuiltinSectionId {
  return (BUILTIN_SECTION_IDS as readonly string[]).includes(id);
}

/**
 * The one place the `overview` (Lesson field name) vs `lessonOverview` (section id /
 * label key) mismatch is resolved. `rubric` also carries the pre-existing legacy fallback
 * to `taChecklist` that lib/google.ts's getRubric() already handles for old Firestore docs.
 */
export const LEGACY_LESSON_FIELD: Record<BuiltinSectionId, string[]> = {
  lessonOverview: ["overview"],
  learningTargets: ["learningTargets"],
  vocabulary: ["vocabulary"],
  warmUp: ["warmUp"],
  guidedLab: ["guidedLab"],
  selfPaced: ["selfPaced"],
  submissionChecklist: ["submissionChecklist"],
  checkpoint: ["checkpoint"],
  industryBestPractices: ["industryBestPractices"],
  devJournalPrompt: ["devJournalPrompt"],
  rubric: ["rubric", "taChecklist"],
};

/**
 * Order + flags reproduce today's exact behavior:
 * - includeInOverviewDoc is true ONLY for learningTargets — the only section whose content
 *   currently appears in the Overview Doc body (lessonOverview's label is used for the doc
 *   TITLE only, never body content).
 * - includeInQuizContext matches generateQuizQuestions' current hardcoded field list
 *   (lessonOverview/overview, learningTargets, vocabulary, guidedLab, industryBestPractices).
 * - skipIfEmpty is true only for vocabulary (Classic Slides only, now retired).
 * Labels here are overridden by DEFAULT_SECTION_LABELS / user / course settings at
 * resolution time (see lib/sections.ts) — the strings below are the last-resort fallback.
 */
export const DEFAULT_SECTIONS: SectionDef[] = [
  { id: "lessonOverview", label: "Lesson Overview", position: "before-slides", includeInOverviewDoc: false, includeInQuizContext: true, skipIfEmpty: false, rows: 4, hint: "Paragraph overview of everything covered in this lesson." },
  { id: "learningTargets", label: "Learning Targets", position: "before-slides", includeInOverviewDoc: true, includeInQuizContext: true, skipIfEmpty: false, rows: 4, hint: "3–8 bullet points of specific, measurable learning objectives." },
  { id: "vocabulary", label: "Vocabulary", position: "before-slides", includeInOverviewDoc: false, includeInQuizContext: true, skipIfEmpty: true, rows: 4, hint: "Key terms and definitions students need to know for this lesson." },
  { id: "warmUp", label: "Opening Activity", position: "before-slides", includeInOverviewDoc: false, includeInQuizContext: false, skipIfEmpty: false, rows: 4, hint: "3–5 questions to engage students at the start of class." },
  { id: "guidedLab", label: "Guided Activity", position: "after-slides", includeInOverviewDoc: false, includeInQuizContext: true, skipIfEmpty: false, rows: 6, hint: "In-class instructor-led exercise. Must be step-by-step." },
  { id: "selfPaced", label: "Independent Activity", position: "after-slides", includeInOverviewDoc: false, includeInQuizContext: false, skipIfEmpty: false, rows: 6, hint: "Independent student exercise. Must be step-by-step." },
  { id: "submissionChecklist", label: "Requirements Checklist", position: "after-slides", includeInOverviewDoc: false, includeInQuizContext: false, skipIfEmpty: false, slideAnchor: false, rows: 4, hint: "Specific requirements students must meet and turn in." },
  { id: "checkpoint", label: "Common Problems / FAQ", position: "after-slides", includeInOverviewDoc: false, includeInQuizContext: false, skipIfEmpty: false, rows: 4, hint: "Common problems and challenges students may face, with suggested solutions." },
  { id: "industryBestPractices", label: "Best Practices", position: "after-slides", includeInOverviewDoc: false, includeInQuizContext: true, skipIfEmpty: false, rows: 4, hint: "Standards, best practices, and tips & tricks for this topic." },
  { id: "devJournalPrompt", label: "Reflection Journal", position: "after-slides", includeInOverviewDoc: false, includeInQuizContext: false, skipIfEmpty: false, slideAnchor: false, rows: 4, hint: "3–5 specific, evidence-based reflection questions." },
  { id: "rubric", label: "Assessment / Rubric", position: "after-slides", includeInOverviewDoc: false, includeInQuizContext: false, skipIfEmpty: false, slideAnchor: false, rows: 4, hint: "Checklist used to assess student submissions." },
];

/** Whether a section is a locked Notes to Slides heading. Doc-only builtins (Requirements
 * Checklist, Reflection Journal, Assessment / Rubric) default off; everything else defaults on.
 * Courses saved before this flag existed get those defaults with no migration. */
export function isSlideAnchor(section: SectionDef): boolean {
  if (typeof section.slideAnchor === "boolean") return section.slideAnchor;
  if (isBuiltinId(section.id)) return DEFAULT_SECTIONS.find(d => d.id === section.id)?.slideAnchor ?? true;
  return true;
}

/** Per-builtin-section AI-Fill instruction fragments — moved verbatim out of lib/ai.ts's prompt. */
export const BUILTIN_AI_INSTRUCTIONS: Record<BuiltinSectionId, string> = {
  lessonOverview: "3-4 sentence paragraph overview of the lesson",
  learningTargets: "5-7 bullet points (one per line, starting with •) of specific measurable objectives",
  vocabulary: "8-12 key terms with concise definitions, formatted as 'Term: Definition' (one per line)",
  warmUp: "3-5 questions (numbered) to engage students at the start of class",
  guidedLab: "Step-by-step instructor-led exercise (numbered steps)",
  selfPaced: "Step-by-step independent exercise (numbered steps)",
  submissionChecklist: "Specific requirements students must meet (bullet points starting with •)",
  checkpoint: "3-5 common problems students may face with solutions",
  industryBestPractices: "3-5 standards and best practices for this topic (bullet points)",
  devJournalPrompt: "3-5 specific reflection questions",
  rubric: "Comprehension and objective checklist (bullet points with point values)",
};
