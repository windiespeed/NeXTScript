import { describe, expect, it } from "vitest";
import { DECK_SYSTEM_PROMPT, buildUserMessage } from "@/lib/deck/generate";
import { CURRICULUM_ARCHITECT_SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ingestionPrompt";
import { STUDENT_LEVEL_GUIDANCE, STUDENT_LEVEL_UI_HINTS } from "@/lib/studentLevel";
import { describeProgram, resolveProgramContext } from "@/lib/programContext";
import type { Course } from "@/types/course";

// The AI prompts serve every subject (English, nursing, business...), so nothing hard-coded in
// them may assume a tech or coding course. Course details supply the subject instead.
const TECH_WORDING = /NeXTStack|coding academ|developer program|learning to code|idiomatic code|full-stack|technical definition|error handling|technical depth/i;

describe("subject-neutral AI prompts", () => {
  it("has no tech-specific wording in the fixed prompt text", () => {
    for (const text of [
      DECK_SYSTEM_PROMPT,
      CURRICULUM_ARCHITECT_SYSTEM_PROMPT,
      ...Object.values(STUDENT_LEVEL_GUIDANCE),
      ...Object.values(STUDENT_LEVEL_UI_HINTS),
    ]) {
      expect(text).not.toMatch(TECH_WORDING);
    }
  });

  it("gives the deck builder the course's subject and the level guidance", () => {
    const m = buildUserMessage({
      notes: "similes and metaphors",
      program: { industry: "Education", subject: "English 9" },
      studentLevel: "advanced",
    });
    expect(m).toContain("Program: Education — English 9");
    expect(m).toContain(`Student level: advanced. ${STUDENT_LEVEL_GUIDANCE.advanced}`);
  });

  it("gives Notes to Slides the course's subject", () => {
    const p = buildUserPrompt("notes", { program: { industry: "", subject: "Nursing 101" } });
    expect(p).toContain("Program: Nursing 101");
    expect(buildUserPrompt("notes", {})).not.toContain("Program:");
  });

  it("takes industry and subject from the course only", () => {
    const course = { settings: { industry: " Healthcare ", subject: "" } } as unknown as Course;
    expect(resolveProgramContext(course)).toEqual({ industry: "Healthcare", subject: "" });
    expect(resolveProgramContext(undefined)).toEqual({ industry: "", subject: "" });
    expect(describeProgram({ industry: "", subject: "" })).toBeNull();
  });
});
