import { FieldValue } from "firebase-admin/firestore";
import { courseStore } from "@/lib/courseStore";
import { userSettings, type UserSettings } from "@/lib/userSettings";
import type { Course, CourseSettings } from "@/types/course";

/** Profile fields that used to be app-wide defaults and are now course settings only. */
const LEGACY_FIELDS = ["defaultSources", "industry", "subject", "sections", "sectionLabels"] as const;

function hasValue(settings: UserSettings): boolean {
  return !!(
    settings.defaultSources?.trim() ||
    settings.industry?.trim() ||
    settings.subject?.trim() ||
    (settings.sections && settings.sections.length > 0) ||
    Object.values(settings.sectionLabels ?? {}).some((v) => typeof v === "string" && v.trim())
  );
}

/** What a course needs copied from the old Profile values so it keeps behaving as it did. */
function patchFor(course: Course, legacy: UserSettings): Partial<CourseSettings> {
  const own = course.settings ?? ({} as CourseSettings);
  const patch: Partial<CourseSettings> = {};
  if (legacy.defaultSources?.trim() && !own.defaultSources?.trim()) patch.defaultSources = legacy.defaultSources;
  if (legacy.industry?.trim() && !own.industry?.trim()) patch.industry = legacy.industry.trim();
  if (legacy.subject?.trim() && !own.subject?.trim()) patch.subject = legacy.subject.trim();
  if (!own.sections || own.sections.length === 0) {
    // A course without its own sections used the Profile sections, else the built-in sections
    // with Profile labels under the course's own labels. Freeze that into the course.
    if (legacy.sections && legacy.sections.length > 0) {
      patch.sections = legacy.sections;
    } else if (legacy.sectionLabels && Object.keys(legacy.sectionLabels).length > 0) {
      const merged = { ...legacy.sectionLabels, ...own.sectionLabels } as CourseSettings["sectionLabels"];
      if (JSON.stringify(merged) !== JSON.stringify(own.sectionLabels)) patch.sectionLabels = merged;
    }
  }
  return patch;
}

/**
 * AI sources, Industry, Subject Area and the section list used to have app-wide defaults in
 * Profile. They now live only in each course's settings. For anyone who still has old values
 * saved, copy each one into every course they own that has no value of its own, then remove the
 * old values. Courses that already have a value keep it, and courses shared with the user (owned
 * by someone else) are left alone. If the user owns no courses yet, the old values are kept until
 * they create one, so their first course picks them up.
 *
 * Returns the course list with any copied values applied, so the caller can respond with it.
 */
export async function carryOverProfileDefaults(email: string, courses: Course[]): Promise<Course[]> {
  const settings = await userSettings.get(email);
  if (!LEGACY_FIELDS.some((f) => settings[f] !== undefined)) return courses;

  const owner = email.toLowerCase();
  const owned = courses.filter((c) => c.userId?.toLowerCase() === owner);
  const meaningful = hasValue(settings);
  if (meaningful && owned.length === 0) return courses;

  const updated = new Map<string, Course>();
  if (meaningful) {
    for (const course of owned) {
      const patch = patchFor(course, settings);
      if (Object.keys(patch).length === 0) continue;
      const next = await courseStore.update(course.id, { settings: patch as CourseSettings });
      if (next) updated.set(course.id, next);
    }
  }
  const clear: Partial<Record<(typeof LEGACY_FIELDS)[number], FieldValue>> = {};
  for (const f of LEGACY_FIELDS) if (settings[f] !== undefined) clear[f] = FieldValue.delete();
  await userSettings.save(email, clear);
  return courses.map((c) => updated.get(c.id) ?? c);
}
