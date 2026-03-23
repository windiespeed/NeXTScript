import type { FormQuestion } from "./form";

export interface SavedProject {
  id: string;
  userId: string;
  lessonId?: string;      // single-lesson link (legacy + deck/single quiz)
  lessonIds?: string[];   // multi-lesson quiz: linked to all these lessons
  moduleId?: string;      // module-scoped quiz
  courseId?: string;      // course-scoped quiz
  type: "deck" | "form";
  title: string;
  subtitle?: string;
  description?: string;
  isQuiz?: boolean;
  url: string;            // empty string for drafts; populated after generation
  status?: "draft" | "generated"; // quiz drafts are saved without generating to Google
  questions?: FormQuestion[];     // stored questions for quiz drafts
  createdAt: string;
}
