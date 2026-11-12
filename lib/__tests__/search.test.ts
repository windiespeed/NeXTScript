import { describe, expect, it } from "vitest";
import { searchAll, queryWords } from "@/lib/search";
import type { Course } from "@/types/course";
import type { Lesson } from "@/types/lesson";

const lesson = (id: string, patch: Partial<Lesson>): Lesson =>
  ({ id, title: "", subtitle: "", topics: "", tag: "", overview: "", learningTargets: "", vocabulary: "",
     status: "draft", deadline: "", updatedAt: "2026-01-01", ...patch }) as Lesson;
const course = (id: string, patch: Partial<Course>): Course =>
  ({ id, title: "", description: "", gradeLevel: "", term: "", lessonIds: [], settings: { subject: "" }, ...patch }) as Course;

describe("searchAll", () => {
  const courses = [
    course("c1", { title: "Web Development", description: "HTML, CSS and React", lessonIds: ["l1", "l2"] }),
    course("c2", { title: "Nursing 101", settings: { subject: "Healthcare" } as Course["settings"] }),
  ];
  const lessons = [
    lesson("l1", { title: "Intro to React", courseId: "c1", topics: "components, hooks" }),
    lesson("l2", { title: "CSS Grid", courseId: "c1", overview: "Lay out pages. React comes later." }),
    lesson("l3", { title: "Vital Signs", vocabulary: "pulse, blood pressure" }),
  ];

  it("returns nothing for a blank query", () => {
    expect(searchAll("   ", courses, lessons)).toEqual({ query: "", courses: [], lessons: [] });
  });

  it("is case-insensitive and ranks title matches first", () => {
    const r = searchAll("REACT", courses, lessons);
    expect(r.lessons.map(l => l.id)).toEqual(["l1", "l2"]);
    expect(r.courses.map(c => c.id)).toEqual(["c1"]);
  });

  it("needs every word, across any field", () => {
    expect(searchAll("react hooks", courses, lessons).lessons.map(l => l.id)).toEqual(["l1"]);
    expect(searchAll("react nursing", courses, lessons).lessons).toEqual([]);
  });

  it("adds the course title and a snippet for non-title matches", () => {
    const [hit] = searchAll("blood", courses, lessons).lessons;
    expect(hit.id).toBe("l3");
    expect(hit.snippet).toContain("blood pressure");
    const [grid] = searchAll("grid", courses, lessons).lessons;
    expect(grid.courseTitle).toBe("Web Development");
    expect(grid.snippet).toBeUndefined();
  });

  it("matches course subject", () => {
    expect(searchAll("healthcare", courses, lessons).courses.map(c => c.id)).toEqual(["c2"]);
  });

  it("splits words on whitespace", () => {
    expect(queryWords("  a   B ")).toEqual(["a", "b"]);
  });
});
