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
  url: string;
  createdAt: string;
}
