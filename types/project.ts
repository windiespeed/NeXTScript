import type { FormQuestion } from "./form";
import type { PresentationAST } from "./slideAst";

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
  // Content snapshots for "deck" projects — captured once at creation so a lesson can have
  // multiple decks and each keeps its own source content, independent of the lesson's own
  // (mutable) fields. Exactly one of these is set, depending on which pipeline built the deck.
  slideContent?: string;           // classic pipeline (buildSlideDeck) snapshot
  presentationAST?: PresentationAST; // Notes to Slides (buildSlideDeckFromAst) snapshot
  createdAt: string;
}
