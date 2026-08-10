import { DEFAULT_SECTION_LABELS, type SectionLabels } from "@/lib/sectionLabels";
import {
  DEFAULT_SECTIONS,
  LEGACY_LESSON_FIELD,
  isBuiltinId,
  type SectionDef,
} from "@/types/section";

/** Anything with a (possibly absent) `sections` map — matches both the full `Lesson` type
 * and the `Partial<LessonInput>` shapes AI-generation code works with. Legacy field lookup
 * inside getSectionContent() casts to a plain record rather than requiring an index
 * signature here, since named interfaces like `Lesson` don't carry one. */
type LessonContentSource = { sections?: Record<string, string> };

interface ResolveSectionsOpts {
  course?: { settings?: { sectionLabels?: Partial<SectionLabels>; sections?: SectionDef[] } } | null;
  userSettings?: { sectionLabels?: Partial<SectionLabels>; sections?: SectionDef[] } | null;
}

/**
 * Resolves the active, ordered section list, in precedence: explicit course-level sections
 * > explicit user-level sections > synthesized defaults (DEFAULT_SECTIONS with labels
 * overridden via the pre-existing defaults -> user -> course label merge). This synthesis
 * path is what lets documents that have never touched `sections` keep behaving exactly as
 * before, with zero Firestore migration.
 */
export function resolveSections(opts: ResolveSectionsOpts = {}): SectionDef[] {
  if (opts.course?.settings?.sections && opts.course.settings.sections.length > 0) {
    return opts.course.settings.sections;
  }
  if (opts.userSettings?.sections && opts.userSettings.sections.length > 0) {
    return opts.userSettings.sections;
  }
  const labels: SectionLabels = {
    ...DEFAULT_SECTION_LABELS,
    ...opts.userSettings?.sectionLabels,
    ...opts.course?.settings?.sectionLabels,
  };
  return DEFAULT_SECTIONS.map(section =>
    isBuiltinId(section.id) ? { ...section, label: labels[section.id] } : section
  );
}

/**
 * Reads one section's content off a lesson. If the lesson has ever been saved through the
 * new dynamic-sections form, `lesson.sections` is authoritative (even for a key that's
 * missing/blank there — that means genuinely empty, not "go look at the old field"). Only a
 * lesson that has never touched `sections` at all falls back to its legacy fixed field(s).
 */
export function getSectionContent(lesson: LessonContentSource, sectionId: string): string {
  if (lesson.sections) return lesson.sections[sectionId] ?? "";
  if (isBuiltinId(sectionId)) {
    const legacy = lesson as Record<string, unknown>;
    for (const field of LEGACY_LESSON_FIELD[sectionId]) {
      const value = legacy[field];
      if (typeof value === "string" && value) return value;
    }
  }
  return "";
}

/** Every section's content as a plain id-keyed map — for duplicate-lesson and AI-fill-merge call sites. */
export function getAllSectionContent(lesson: LessonContentSource, sections: SectionDef[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const section of sections) {
    result[section.id] = getSectionContent(lesson, section.id);
  }
  return result;
}
