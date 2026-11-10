import { describe, expect, it } from "vitest";
import { DEFAULT_COURSE_SETTINGS } from "@/types/course";
import { DEFAULT_SECTIONS } from "@/types/section";
import {
  blankDocSchema,
  courseCreateSchema,
  coursePatchSchema,
  lessonCreateSchema,
  lessonResourceCreateSchema,
  overviewDocSchema,
  parsePatch,
  projectPatchSchema,
  quizCreateSchema,
  readBody,
  userSettingsPatchSchema,
} from "@/lib/validation";

const OWNED = { id: "x", userId: "attacker@example.com", teacherId: "t", createdAt: "2000", updatedAt: "2000" };

describe("course schemas", () => {
  it("accepts what the Course Settings page saves", () => {
    const r = parsePatch(coursePatchSchema, {
      title: "Web 101", description: "", gradeLevel: "Adult Ed", term: "Feb 2026",
      settings: { ...DEFAULT_COURSE_SETTINGS, sections: DEFAULT_SECTIONS },
    });
    expect(r.ok).toBe(true);
  });

  it("drops ownership and server-managed fields", () => {
    const r = parsePatch(coursePatchSchema, {
      ...OWNED, driveFolderId: "f", driveFolderShared: true, studentIds: ["s"], title: "T",
    });
    expect(r.ok && r.data).toEqual({ title: "T" });
  });

  it("keeps nulls that unlink a classroom", () => {
    const r = parsePatch(coursePatchSchema, { googleClassroomId: null, googleClassroomName: null });
    expect(r.ok && r.data).toEqual({ googleClassroomId: null, googleClassroomName: null });
  });

  it("lowercases collaborators and rejects non-emails", () => {
    const ok = parsePatch(coursePatchSchema, { collaborators: [" Co@Example.org "] });
    expect(ok.ok && ok.data.collaborators).toEqual(["co@example.org"]);
    expect(parsePatch(coursePatchSchema, { collaborators: ["not an email"] }).ok).toBe(false);
  });

  it("refuses script links in course resources but keeps scheme-less links", () => {
    const bad = parsePatch(coursePatchSchema, { resources: [{ id: "1", label: "x", url: "javascript:alert(1)" }] });
    expect(bad.ok).toBe(false);
    const sneaky = parsePatch(coursePatchSchema, { resources: [{ id: "1", label: "x", url: "java\tscript:alert(1)" }] });
    expect(sneaky.ok).toBe(false);
    const old = parsePatch(coursePatchSchema, { resources: [{ id: "1", label: "x", url: "drive.google.com/file/d/abc" }] });
    expect(old.ok).toBe(true);
  });

  it("requires a title to create, and ignores collaborators there", () => {
    expect(parsePatch(courseCreateSchema, { title: "  " }).ok).toBe(false);
    const r = parsePatch(courseCreateSchema, { title: "Copy", lessonIds: [], collaborators: ["a@b.co"] });
    expect(r.ok && r.data).toEqual({ title: "Copy", lessonIds: [] });
  });
});

describe("create and small write schemas", () => {
  it("lesson create needs a title and course, and drops server fields", () => {
    expect(parsePatch(lessonCreateSchema, { title: "L" }).ok).toBe(false);
    const r = parsePatch(lessonCreateSchema, { title: "L", courseId: "c", status: "done", ...OWNED });
    expect(r.ok && r.data).toEqual({ title: "L", courseId: "c" });
  });

  it("quiz create needs at least one question and fills question defaults", () => {
    expect(parsePatch(quizCreateSchema, { title: "Q", courseId: "c", questions: [] }).ok).toBe(false);
    const r = parsePatch(quizCreateSchema, {
      title: "Q", courseId: "c", questions: [{ id: "1", type: "short_answer", text: "Why?" }],
    });
    expect(r.ok && r.data.questions[0]).toEqual({
      id: "1", type: "short_answer", text: "Why?", options: [], correctAnswer: "", required: true,
    });
  });

  it("project patch keeps the quiz editor's fields and drops url/type/status", () => {
    const r = parsePatch(projectPatchSchema, {
      title: "Q", lessonIds: ["l"], courseId: "c", moduleId: "", questions: [],
      url: "https://evil", type: "deck", status: "generated", ...OWNED,
    });
    expect(r.ok && r.data).toEqual({ title: "Q", lessonIds: ["l"], courseId: "c", moduleId: "", questions: [] });
  });

  it("lesson resources need a label and a safe url", () => {
    expect(parsePatch(lessonResourceCreateSchema, { label: "x", url: "" }).ok).toBe(false);
    expect(parsePatch(lessonResourceCreateSchema, { label: "x", url: "data:text/html,hi" }).ok).toBe(false);
    const r = parsePatch(lessonResourceCreateSchema, { label: " Notes ", url: " https://example.org " });
    expect(r.ok && r.data).toEqual({ label: "Notes", url: "https://example.org", type: "link" });
  });

  it("blank doc type is limited to doc, sheet and slides", () => {
    expect(parsePatch(blankDocSchema, { name: "x", docType: "exe" }).ok).toBe(false);
    expect(parsePatch(blankDocSchema, { name: "x", docType: "sheet" }).ok).toBe(true);
  });

  it("overview doc defaults to no decks or quizzes", () => {
    const r = parsePatch(overviewDocSchema, {});
    expect(r.ok && r.data).toEqual({ deckIds: [], quizIds: [] });
  });
});

describe("user settings patch", () => {
  it("only returns the keys that were sent", () => {
    const r = parsePatch(userSettingsPatchSchema, { industry: "Coding", junk: 1 });
    expect(r.ok && r.data).toEqual({ industry: "Coding" });
  });
  it("rejects blank or oversized API keys", () => {
    expect(parsePatch(userSettingsPatchSchema, { anthropicKey: "   " }).ok).toBe(false);
    expect(parsePatch(userSettingsPatchSchema, { anthropicKey: "k".repeat(501) }).ok).toBe(false);
  });
});

describe("readBody", () => {
  const req = (body: string) => new Request("http://x", { method: "POST", body });
  it("turns malformed JSON into a 400 message", async () => {
    expect(await readBody(req("{oops"), overviewDocSchema)).toEqual({ ok: false, error: "Invalid request: expected JSON." });
  });
  it("treats an empty body as {} when allowed", async () => {
    const r = await readBody(req(""), overviewDocSchema, { emptyOk: true });
    expect(r.ok).toBe(true);
  });
});
