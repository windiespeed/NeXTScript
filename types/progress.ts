export interface StudentProgress {
  id: string;
  studentId: string;
  exerciseId: string;
  teacherId: string;
  classId: string;
  status: "in_progress" | "completed";
  code: string;
  attempts: number;
  completedAt?: string;
  updatedAt: string;
}
