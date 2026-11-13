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
  slideContent?: string;           // retired Classic Slides snapshot (old decks only)
  presentationAST?: PresentationAST; // Notes to Slides (buildSlideDeckFromAst) snapshot
  // ── Notes to Slides decks (a lesson can have several; see lib/lessonDecks.ts) ──
  // A deck is saved here from its first Save Draft (status "draft", url "") and re-exporting it
  // updates this same record. presentationAST is then the deck's working copy.
  /** The notes this deck was generated from, so reopening it brings them back. */
  slideNotes?: string;
  /** Saved after the last export, so the Drive file is behind the working copy. */
  hasUnexportedEdits?: boolean;
  /** An older export of a lesson's single deck from before lessons could have several decks.
   * Kept and listed, but not attached when the lesson is published to Classroom. */
  earlierVersion?: boolean;
  updatedAt?: string;
  createdAt: string;
}
