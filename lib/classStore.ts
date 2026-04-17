import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/firebase";
import type { Class, ClassInput } from "@/types/class";

const COLLECTION = "classes";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export const classStore = {
  async getAll(teacherId: string): Promise<Class[]> {
    const snapshot = await getDb().collection(COLLECTION).where("teacherId", "==", teacherId).get();
    return snapshot.docs
      .map((doc) => doc.data() as Class)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getById(id: string): Promise<Class | undefined> {
    const doc = await getDb().collection(COLLECTION).doc(id).get();
    if (!doc.exists) return undefined;
    return doc.data() as Class;
  },

  async getByJoinCode(code: string): Promise<Class | undefined> {
    const snap = await getDb().collection(COLLECTION).where("joinCode", "==", code.toUpperCase()).limit(1).get();
    if (snap.empty) return undefined;
    return snap.docs[0].data() as Class;
  },

  async create(input: ClassInput, teacherId: string): Promise<Class> {
    const now = new Date().toISOString();
    const cls: Class = {
      ...input,
      id: uuidv4(),
      teacherId,
      joinCode: generateJoinCode(),
      studentIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await getDb().collection(COLLECTION).doc(cls.id).set(cls);
    return cls;
  },

  async update(id: string, patch: Partial<Class>): Promise<Class | null> {
    const ref = getDb().collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated: Class = { ...(doc.data() as Class), ...patch, updatedAt: new Date().toISOString() };
    await ref.set(updated);
    return updated;
  },

  async addStudent(id: string, studentId: string): Promise<void> {
    const ref = getDb().collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return;
    const cls = doc.data() as Class;
    if (!cls.studentIds.includes(studentId)) {
      await ref.update({ studentIds: [...cls.studentIds, studentId], updatedAt: new Date().toISOString() });
    }
  },

  async delete(id: string): Promise<boolean> {
    const ref = getDb().collection(COLLECTION).doc(id);
    if (!(await ref.get()).exists) return false;
    await ref.delete();
    return true;
  },
};
