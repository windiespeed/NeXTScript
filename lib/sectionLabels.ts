export interface SectionLabels {
  warmUp: string;
  guidedLab: string;
  selfPaced: string;
  submissionChecklist: string;
  checkpoint: string;
  industryBestPractices: string;
  devJournalPrompt: string;
  rubric: string;
}

export const DEFAULT_SECTION_LABELS: SectionLabels = {
  warmUp: "Opening Activity",
  guidedLab: "Guided Activity",
  selfPaced: "Independent Activity",
  submissionChecklist: "Requirements Checklist",
  checkpoint: "Common Problems / FAQ",
  industryBestPractices: "Best Practices",
  devJournalPrompt: "Reflection Journal",
  rubric: "Assessment / Rubric",
};
