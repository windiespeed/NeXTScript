import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/firebase";
import type { Concept, ConceptInput } from "@/types/concept";

const COLLECTION = "concepts";

export const conceptStore = {
  async getAll(teacherId: string): Promise<Concept[]> {
    const snap = await getDb().collection(COLLECTION).where("teacherId", "==", teacherId).get();
    return snap.docs.map(d => d.data() as Concept).sort((a, b) => a.order - b.order);
  },

  async getByClass(classId: string): Promise<Concept[]> {
    const snap = await getDb().collection(COLLECTION).where("classId", "==", classId).get();
    return snap.docs.map(d => d.data() as Concept).sort((a, b) => a.order - b.order);
  },

  async getById(id: string): Promise<Concept | undefined> {
    const doc = await getDb().collection(COLLECTION).doc(id).get();
    if (!doc.exists) return undefined;
    return doc.data() as Concept;
  },

  async create(input: ConceptInput, teacherId: string, classId: string): Promise<Concept> {
    const now = new Date().toISOString();
    const concept: Concept = { ...input, id: uuidv4(), teacherId, classId, createdAt: now, updatedAt: now };
    await getDb().collection(COLLECTION).doc(concept.id).set(concept);
    return concept;
  },

  async createMany(inputs: ConceptInput[], teacherId: string, classId: string): Promise<Concept[]> {
    const now = new Date().toISOString();
    const db = getDb();
    const batch = db.batch();
    const concepts: Concept[] = inputs.map(input => ({
      ...input,
      id: uuidv4(),
      teacherId,
      classId,
      createdAt: now,
      updatedAt: now,
    }));
    concepts.forEach(c => batch.set(db.collection(COLLECTION).doc(c.id), c));
    await batch.commit();
    return concepts;
  },

  async update(id: string, patch: Partial<Concept>): Promise<Concept | null> {
    const ref = getDb().collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated: Concept = { ...(doc.data() as Concept), ...patch, updatedAt: new Date().toISOString() };
    await ref.set(updated);
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    const ref = getDb().collection(COLLECTION).doc(id);
    if (!(await ref.get()).exists) return false;
    await ref.delete();
    return true;
  },
};
