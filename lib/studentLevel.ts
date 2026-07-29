/**
 * Single source of truth for the "Student Level" concept used across every AI generation
 * flow (lib/ai.ts's fillLesson/generateQuizQuestions, lib/ingestionService.ts's
 * ingestRawContent) and everywhere it's shown in the UI (LessonForm, Notes to Slides page).
 *
 * Deliberately subject-neutral — this app generates curriculum for any subject, not just
 * programming, so nothing here assumes a coding context.
 */

export type StudentLevel = "beginner" | "intermediate" | "advanced";

/** Full instruction paragraph injected into AI prompts. */
export const STUDENT_LEVEL_GUIDANCE: Record<StudentLevel, string> = {
  beginner: "The audience has no prior background in this subject. Use plain, everyday language, define any specialized terms the moment they appear, and don't assume exposure to related concepts or tools.",
  intermediate: "The audience has some prior exposure to this subject. Use standard terminology, reference concepts they likely already know, and keep explanations moderately detailed rather than starting from zero.",
  advanced: "The audience is experienced in this subject. Use precise, field-specific terminology, assume familiarity with foundational concepts, and focus on depth, nuance, edge cases, and best practices.",
};

/** Compact one-line descriptions shown in the UI under Student Level pickers. */
export const STUDENT_LEVEL_UI_HINTS: Record<StudentLevel, string> = {
  beginner: "No prior background in this subject — simple language, extra explanation, no assumed knowledge.",
  intermediate: "Some prior exposure to this subject — moderate complexity, references prior knowledge.",
  advanced: "Strong background in this subject — technical depth, field-specific terminology.",
};
