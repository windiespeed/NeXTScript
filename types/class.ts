import type { ExerciseConcept } from "./exercise";

export interface Class {
  id: string;
  teacherId: string;        // teacher's email (userId)
  name: string;
  joinCode: string;         // 6-char alphanumeric shown to students
  studentIds: string[];     // student emails
  assignedConcepts: ExerciseConcept[];  // concepts enabled for this class
  language: "javascript" | "python" | "html-css";
  createdAt: string;
  updatedAt: string;
}

export type ClassInput = Omit<Class, "id" | "teacherId" | "joinCode" | "studentIds" | "createdAt" | "updatedAt">;
