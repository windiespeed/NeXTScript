import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/firebase";
import type { Exercise, ExerciseInput } from "@/types/exercise";

const COLLECTION = "exercises";

export const exerciseStore = {
  async getAll(userId: string, concept?: string): Promise<Exercise[]> {
    let query = getDb().collection(COLLECTION).where("userId", "==", userId) as FirebaseFirestore.Query;
    if (concept) query = query.where("concept", "==", concept);
    const snapshot = await query.get();
    return snapshot.docs
      .map((doc) => doc.data() as Exercise)
      .sort((a, b) => {
        if (a.concept !== b.concept) return a.concept.localeCompare(b.concept);
        return a.order - b.order;
      });
  },

  /** All exercises in a course, regardless of which collaborator authored them. */
  async getAllByCourse(courseId: string, concept?: string): Promise<Exercise[]> {
    let query = getDb().collection(COLLECTION).where("courseId", "==", courseId) as FirebaseFirestore.Query;
    if (concept) query = query.where("concept", "==", concept);
    const snapshot = await query.get();
    return snapshot.docs
      .map((doc) => doc.data() as Exercise)
      .sort((a, b) => {
        if (a.concept !== b.concept) return a.concept.localeCompare(b.concept);
        return a.order - b.order;
      });
  },

  /** A teacher's exercises that haven't been assigned to a course yet (legacy data cleanup). */
  async getUnassigned(userId: string): Promise<Exercise[]> {
    const all = await this.getAll(userId);
    return all.filter((e) => !e.courseId);
  },

  async getById(id: string): Promise<Exercise | undefined> {
    const doc = await getDb().collection(COLLECTION).doc(id).get();
    if (!doc.exists) return undefined;
    return doc.data() as Exercise;
  },

  async create(input: ExerciseInput, userId: string): Promise<Exercise> {
    const now = new Date().toISOString();
    const exercise: Exercise = { ...input, id: uuidv4(), userId, createdAt: now, updatedAt: now };
    await getDb().collection(COLLECTION).doc(exercise.id).set(exercise);
    return exercise;
  },

  async createMany(inputs: ExerciseInput[], userId: string, courseId: string): Promise<void> {
    const now = new Date().toISOString();
    const db = getDb();
    const BATCH_SIZE = 400;
    for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      inputs.slice(i, i + BATCH_SIZE).forEach((input) => {
        const exercise: Exercise = { ...input, id: uuidv4(), userId, courseId, createdAt: now, updatedAt: now };
        batch.set(db.collection(COLLECTION).doc(exercise.id), exercise);
      });
      await batch.commit();
    }
  },

  async update(id: string, patch: Partial<Exercise>): Promise<Exercise | null> {
    const ref = getDb().collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated: Exercise = { ...(doc.data() as Exercise), ...patch, updatedAt: new Date().toISOString() };
    await ref.set(updated);
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    const ref = getDb().collection(COLLECTION).doc(id);
    if (!(await ref.get()).exists) return false;
    await ref.delete();
    return true;
  },

  async hasSeededCourse(courseId: string): Promise<boolean> {
    const snap = await getDb().collection(COLLECTION)
      .where("courseId", "==", courseId)
      .where("isSeeded", "==", true)
      .limit(1)
      .get();
    return !snap.empty;
  },
};
