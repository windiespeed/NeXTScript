import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import type { Course, CourseInput } from "@/types/course";
import { DEFAULT_COURSE_SETTINGS } from "@/types/course";

const COLLECTION = "courses";

export const courseStore = {
  async getAll(userId: string): Promise<Course[]> {
    const db = getDb();
    // Collaborators are always stored lowercased (see app/api/courses/[id]/route.ts's PUT
    // handler) — array-contains is an exact, case-sensitive match, so the query side must be
    // lowercased too or a collaborator whose own session email isn't already all-lowercase gets
    // zero results here despite canAccessCourse (which does lowercase both sides) correctly
    // granting them access via a direct link.
    // Course.userId isn't normalized at creation either, so the owned query runs against both
    // the raw session email and its lowercased form — whichever the stored userId happens to
    // match — and dedupes below. A single exact-match query here would silently drop a course
    // whenever the stored casing differs from the current session's, exactly as it did for
    // collaborators.
    const lowered = userId.toLowerCase();
    const ownedQueries = [db.collection(COLLECTION).where("userId", "==", userId).get()];
    if (lowered !== userId) {
      ownedQueries.push(db.collection(COLLECTION).where("userId", "==", lowered).get());
    }
    const [ownedSnapshots, shared] = await Promise.all([
      Promise.all(ownedQueries),
      db.collection(COLLECTION).where("collaborators", "array-contains", lowered).get(),
    ]);
    const byId = new Map<string, Course>();
    for (const doc of [...ownedSnapshots.flatMap((s) => s.docs), ...shared.docs]) {
      byId.set(doc.id, { id: doc.id, ...doc.data() } as Course);
    }
    return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getById(id: string): Promise<Course | undefined> {
    const doc = await getDb().collection(COLLECTION).doc(id).get();
    if (!doc.exists) return undefined;
    return { id: doc.id, ...doc.data() } as Course;
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

  /**
   * Add a lesson ID to a course's ordered list (no-op if already present).
   * Uses arrayUnion so concurrent calls (e.g. bulk-duplicating several lessons at once)
   * don't lose updates to each other via a read-then-write race.
   */
  async addLesson(courseId: string, lessonId: string): Promise<void> {
    const ref = getDb().collection(COLLECTION).doc(courseId);
    const doc = await ref.get();
    if (!doc.exists) return;
    await ref.update({ lessonIds: FieldValue.arrayUnion(lessonId), updatedAt: new Date().toISOString() });
  },

  /** Remove a lesson ID from a course's ordered list. Atomic for the same reason as addLesson. */
  async removeLesson(courseId: string, lessonId: string): Promise<void> {
    const ref = getDb().collection(COLLECTION).doc(courseId);
    const doc = await ref.get();
    if (!doc.exists) return;
    await ref.update({ lessonIds: FieldValue.arrayRemove(lessonId), updatedAt: new Date().toISOString() });
  },
};
