/**
 * Simple JSON file-based store for lessons.
 * Swap this out for a real database (Prisma, Supabase, etc.) when ready.
 */

import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { Lesson, LessonInput } from "@/types/lesson";

const DATA_FILE = path.join(process.cwd(), "data", "lessons.json");

function readAll(): Lesson[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw) as Lesson[];
}

function writeAll(lessons: Lesson[]): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(lessons, null, 2));
}

export const store = {
  getAll(): Lesson[] {
    return readAll();
  },

  getById(id: string): Lesson | undefined {
    return readAll().find((l) => l.id === id);
  },

  create(input: LessonInput): Lesson {
    const lessons = readAll();
    const now = new Date().toISOString();
    const lesson: Lesson = {
      ...input,
      id: uuidv4(),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    lessons.push(lesson);
    writeAll(lessons);
    return lesson;
  },

  update(id: string, patch: Partial<Lesson>): Lesson | null {
    const lessons = readAll();
    const idx = lessons.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    lessons[idx] = { ...lessons[idx], ...patch, updatedAt: new Date().toISOString() };
    writeAll(lessons);
    return lessons[idx];
  },

  delete(id: string): boolean {
    const lessons = readAll();
    const next = lessons.filter((l) => l.id !== id);
    if (next.length === lessons.length) return false;
    writeAll(next);
    return true;
  },
};
