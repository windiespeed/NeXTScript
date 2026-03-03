/**
 * Firestore-backed lesson store.
 * All methods are async — API routes must await them.
 */

import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/firebase";
import type { Lesson, LessonInput } from "@/types/lesson";

const COLLECTION = "lessons";

export const store = {
  async getAll(): Promise<Lesson[]> {
    const snapshot = await getDb()
      .collection(COLLECTION)
      .orderBy("createdAt", "desc")
      .get();
    return snapshot.docs.map((doc) => doc.data() as Lesson);
  },

  async getById(id: string): Promise<Lesson | undefined> {
    const doc = await getDb().collection(COLLECTION).doc(id).get();
    if (!doc.exists) return undefined;
    return doc.data() as Lesson;
  },

  async create(input: LessonInput): Promise<Lesson> {
    const now = new Date().toISOString();
    const lesson: Lesson = {
      ...input,
      id: uuidv4(),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    await getDb().collection(COLLECTION).doc(lesson.id).set(lesson);
    return lesson;
  },

  async update(id: string, patch: Partial<Lesson>): Promise<Lesson | null> {
    const ref = getDb().collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated: Lesson = {
      ...(doc.data() as Lesson),
      ...patch,
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
};
