import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/firebase";
import type { Course, CourseInput } from "@/types/course";
import { DEFAULT_COURSE_SETTINGS } from "@/types/course";

const COLLECTION = "courses";

export const courseStore = {
  async getAll(userId: string): Promise<Course[]> {
    const snapshot = await getDb()
      .collection(COLLECTION)
      .where("userId", "==", userId)
      .get();
    return snapshot.docs
      .map((doc) => doc.data() as Course)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getById(id: string): Promise<Course | undefined> {
    const doc = await getDb().collection(COLLECTION).doc(id).get();
    if (!doc.exists) return undefined;
    return doc.data() as Course;
  },

  async create(input: CourseInput, userId: string): Promise<Course> {
    const now = new Date().toISOString();
    const course: Course = {
      ...input,
      settings: { ...DEFAULT_COURSE_SETTINGS, ...input.settings },
      id: uuidv4(),
      userId,
      lessonIds: input.lessonIds ?? [],
      createdAt: now,
      updatedAt: now,
    };
    await getDb().collection(COLLECTION).doc(course.id).set(course);
    return course;
  },

  async update(id: string, patch: Partial<Course>): Promise<Course | null> {
    const ref = getDb().collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const existing = doc.data() as Course;
    const updated: Course = {
      ...existing,
      ...patch,
      // Deep merge settings so callers can patch individual fields
      settings: patch.settings
        ? { ...existing.settings, ...patch.settings }
        : existing.settings,
      updatedAt: new Date().toISOString(),
    };
    await ref.set(updated);
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    const ref = getDb().collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  },

  /** Add a lesson ID to a course's ordered list (no-op if already present). */
  async addLesson(courseId: string, lessonId: string): Promise<void> {
    const ref = getDb().collection(COLLECTION).doc(courseId);
    const doc = await ref.get();
    if (!doc.exists) return;
    const course = doc.data() as Course;
    if (!course.lessonIds.includes(lessonId)) {
      await ref.update({ lessonIds: [...course.lessonIds, lessonId], updatedAt: new Date().toISOString() });
    }
  },

  /** Remove a lesson ID from a course's ordered list. */
  async removeLesson(courseId: string, lessonId: string): Promise<void> {
    const ref = getDb().collection(COLLECTION).doc(courseId);
    const doc = await ref.get();
    if (!doc.exists) return;
    const course = doc.data() as Course;
    await ref.update({
      lessonIds: course.lessonIds.filter((id) => id !== lessonId),
      updatedAt: new Date().toISOString(),
    });
  },
};
