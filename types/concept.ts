export interface Concept {
  id: string;
  teacherId: string;
  courseId?: string;   // preferred going forward
  classId?: string;    // legacy — kept for backward compat during transition
  slug: string;
  label: string;
  description: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type ConceptInput = Omit<Concept, "id" | "teacherId" | "classId" | "courseId" | "createdAt" | "updatedAt">;
