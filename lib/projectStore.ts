import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/firebase";
import type { SavedProject } from "@/types/project";

const COLLECTION = "projects";

export const projectStore = {
  async getAll(userId: string): Promise<SavedProject[]> {
    const snapshot = await getDb()
      .collection(COLLECTION)
      .where("userId", "==", userId)
      .get();
    return snapshot.docs
      .map((doc) => doc.data() as SavedProject)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async create(input: Omit<SavedProject, "id" | "createdAt" | "userId">, userId: string): Promise<SavedProject> {
    const project: SavedProject = {
      ...input,
      id: uuidv4(),
      userId,
      createdAt: new Date().toISOString(),
    };
    await getDb().collection(COLLECTION).doc(project.id).set(project);
    return project;
  },

  async getById(id: string): Promise<SavedProject | null> {
    const doc = await getDb().collection(COLLECTION).doc(id).get();
    return doc.exists ? (doc.data() as SavedProject) : null;
  },

  async delete(id: string): Promise<boolean> {
    const ref = getDb().collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  },
};
