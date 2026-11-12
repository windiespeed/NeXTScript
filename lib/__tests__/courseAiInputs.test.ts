import { describe, expect, it } from "vitest";
import { courseAiInputs } from "@/lib/courseAiInputs";
import { DEFAULT_COURSE_SETTINGS } from "@/types/course";

describe("courseAiInputs", () => {
  it("reads Student Level and Sources from Course Settings", () => {
    const course = { settings: { ...DEFAULT_COURSE_SETTINGS, studentLevel: "advanced" as const, defaultSources: " https://a.org/\nhttps://b.org/ " } };
    expect(courseAiInputs(course)).toEqual({ studentLevel: "advanced", sources: "https://a.org/\nhttps://b.org/" });
  });

  it("returns nothing when the course leaves them blank or there is no course", () => {
    expect(courseAiInputs({ settings: DEFAULT_COURSE_SETTINGS })).toEqual({ studentLevel: undefined, sources: undefined });
    expect(courseAiInputs(undefined)).toEqual({ studentLevel: undefined, sources: undefined });
  });
});
