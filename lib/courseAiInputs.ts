import type { Course } from "@/types/course";
import type { StudentLevel } from "@/lib/studentLevel";

/**
 * Student Level, Sources and the audience (the course's Grade Level) live only in Course Settings. Every AI route reads them from the
 * course through here and ignores any value the browser sends or an older lesson still has
 * saved, so the course is the one place an instructor changes them.
 */
export function courseAiInputs(
  course: (Pick<Course, "settings"> & Partial<Pick<Course, "gradeLevel">>) | null | undefined,
): { studentLevel?: StudentLevel; sources?: string; targetAudience?: string } {
  const level = course?.settings?.studentLevel;
  const sources = course?.settings?.defaultSources?.trim();
  const audience = course?.gradeLevel?.trim();
  return {
    studentLevel: level ? level : undefined,
    sources: sources ? sources : undefined,
    targetAudience: audience ? audience : undefined,
  };
}
