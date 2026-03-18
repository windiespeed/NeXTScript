export interface SavedProject {
  id: string;
  userId: string;
  lessonId?: string;
  type: "deck" | "form";
  title: string;
  subtitle?: string;
  description?: string;
  isQuiz?: boolean;
  url: string;
  createdAt: string;
}
