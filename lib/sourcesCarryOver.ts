import { FieldValue } from "firebase-admin/firestore";
import { courseStore } from "@/lib/courseStore";
import { userSettings } from "@/lib/userSettings";
import type { Course } from "@/types/course";

/**
 * AI sources used to have an app-wide default in Profile (userSettings.defaultSources). They now
 * live only in each course's settings. For anyone who still has the old value saved, copy it into
 * every course they own that has no sources of its own, then remove the old value. Courses that
 * already have sources keep them, and courses shared with the user (owned by someone else) are left
 * alone. If the user owns no courses yet, the old value is kept until they create one.
 *
 * Returns the course list with any copied sources applied, so the caller can respond with it.
 */
export async function carryOverUserSources(email: string, courses: Course[]): Promise<Course[]> {
  const settings = await userSettings.get(email);
  const legacy = settings.defaultSources?.trim();
  if (settings.defaultSources === undefined) return courses;

  const owner = email.toLowerCase();
  const owned = courses.filter((c) => c.userId?.toLowerCase() === owner);
  if (legacy && owned.length === 0) return courses;

  const updated = new Map<string, Course>();
  if (legacy) {
    for (const course of owned) {
      if (course.settings?.defaultSources?.trim()) continue;
      const next = await courseStore.update(course.id, { settings: { defaultSources: settings.defaultSources } as Course["settings"] });
      if (next) updated.set(course.id, next);
    }
  }
  await userSettings.save(email, { defaultSources: FieldValue.delete() });
  return courses.map((c) => updated.get(c.id) ?? c);
}
