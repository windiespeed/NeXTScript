import { describe, expect, it, vi, beforeEach } from "vitest";
import { isAllowedEmail } from "@/lib/emailDomain";
import { isPublicPath } from "@/lib/publicPaths";
import { stripServerOnlyFields } from "@/lib/sessionPayload";
import { decryptSecret, encryptSecret, isEncrypted } from "@/lib/secretBox";
import { lessonPatchSchema, conceptPatchSchema, exercisePatchSchema, parsePatch, stripProtected } from "@/lib/validation";

describe("isAllowedEmail", () => {
  it("allows everyone when no domains are configured", () => {
    expect(isAllowedEmail("a@gmail.com", "")).toBe(true);
    expect(isAllowedEmail("a@gmail.com", undefined)).toBe(true);
  });
  it("only allows listed domains, case-insensitively", () => {
    expect(isAllowedEmail("Teacher@Example.org", "example.org")).toBe(true);
    expect(isAllowedEmail("a@gmail.com", "example.org")).toBe(false);
    expect(isAllowedEmail("a@other.org", " example.org , @other.org ")).toBe(true);
  });
  it("rejects lookalike and missing addresses", () => {
    expect(isAllowedEmail("a@evil-example.org", "example.org")).toBe(false);
    expect(isAllowedEmail("a@example.org.evil.com", "example.org")).toBe(false);
    expect(isAllowedEmail(undefined, "example.org")).toBe(false);
  });
});

describe("isPublicPath", () => {
  it("allows the home page and student view only", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/courses/abc123/student")).toBe(true);
    expect(isPublicPath("/courses/abc123")).toBe(false);
    expect(isPublicPath("/courses/abc123/student/extra")).toBe(false);
    expect(isPublicPath("/profile")).toBe(false);
  });
});

describe("stripServerOnlyFields", () => {
  it("removes the Google access token from the session payload", () => {
    const out = stripServerOnlyFields({ user: { email: "a@b.c" }, accessToken: "ya29.secret", expires: "x" });
    expect(out).toEqual({ user: { email: "a@b.c" }, expires: "x" });
  });
  it("passes through an empty session", () => {
    expect(stripServerOnlyFields(null)).toBeNull();
  });
});

describe("secretBox", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  it("round-trips a value", () => {
    const enc = encryptSecret("sk-ant-123", key);
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain("sk-ant-123");
    expect(decryptSecret(enc, key)).toBe("sk-ant-123");
  });
  it("uses a fresh IV each time", () => {
    expect(encryptSecret("same", key)).not.toBe(encryptSecret("same", key));
  });
  it("passes legacy plaintext through and leaves values alone without a key", () => {
    expect(decryptSecret("sk-plain", key)).toBe("sk-plain");
    expect(encryptSecret("sk-plain", "")).toBe("sk-plain");
  });
  it("fails on a wrong key or tampered value", () => {
    const enc = encryptSecret("secret", key);
    expect(() => decryptSecret(enc, Buffer.alloc(32, 8).toString("base64"))).toThrow();
    expect(() => decryptSecret(enc.slice(0, -4) + "AAAA", key)).toThrow();
  });
});

describe("patch validation", () => {
  it("drops ownership and bookkeeping fields from a lesson patch", () => {
    const r = parsePatch(lessonPatchSchema, { title: "T", userId: "attacker@x.com", id: "z", createdAt: "x", evil: 1 });
    expect(r.ok && r.data).toEqual({ title: "T" });
  });
  it("accepts null to clear a field", () => {
    const r = parsePatch(lessonPatchSchema, { courseId: null, presentationAST: null, presentationStatus: null });
    expect(r.ok && r.data).toEqual({ courseId: null, presentationAST: null, presentationStatus: null });
  });
  it("rejects wrong types with the field name", () => {
    const r = parsePatch(lessonPatchSchema, { released: "yes" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("released");
  });
  it("drops teacherId from concepts and userId from exercises", () => {
    expect(parsePatch(conceptPatchSchema, { label: "L", teacherId: "x" })).toEqual({ ok: true, data: { label: "L" } });
    expect(parsePatch(exercisePatchSchema, { title: "E", userId: "x" })).toEqual({ ok: true, data: { title: "E" } });
  });
  it("stripProtected removes protected and extra fields, rejects non-objects", () => {
    expect(stripProtected({ title: "C", userId: "x", collaborators: [] }, ["collaborators"])).toEqual({ title: "C" });
    expect(stripProtected([1, 2])).toBeNull();
    expect(stripProtected("x")).toBeNull();
  });
});

// ── Access rules ──────────────────────────────────────────────────────────────
const getCourse = vi.fn();
vi.mock("@/lib/courseStore", () => ({ courseStore: { getById: (id: string) => getCourse(id), getAll: vi.fn() } }));
vi.mock("@/lib/projectStore", () => ({ projectStore: {} }));

describe("access rules", async () => {
  const { canAccessCourse, isCourseOwner, canAccessLesson, canAccessCourseId } = await import("@/lib/access");
  const course = { id: "c1", userId: "Owner@x.org", collaborators: ["Helper@x.org"] } as never;

  beforeEach(() => getCourse.mockReset());

  it("lets the owner and collaborators in, case-insensitively", () => {
    expect(canAccessCourse(course, "owner@x.org")).toBe(true);
    expect(canAccessCourse(course, "HELPER@x.org")).toBe(true);
    expect(canAccessCourse(course, "stranger@x.org")).toBe(false);
  });
  it("only the owner is owner", () => {
    expect(isCourseOwner(course, "OWNER@x.org")).toBe(true);
    expect(isCourseOwner(course, "helper@x.org")).toBe(false);
  });
  it("lesson access goes through the lesson owner or its course", async () => {
    getCourse.mockResolvedValue(course);
    expect(await canAccessLesson({ userId: "me@x.org" } as never, "ME@x.org")).toBe(true);
    expect(await canAccessLesson({ userId: "other@x.org", courseId: "c1" } as never, "helper@x.org")).toBe(true);
    expect(await canAccessLesson({ userId: "other@x.org", courseId: "c1" } as never, "stranger@x.org")).toBe(false);
    expect(await canAccessLesson({ userId: "other@x.org" } as never, "helper@x.org")).toBe(false);
  });
  it("denies a missing course", async () => {
    getCourse.mockResolvedValue(null);
    expect(await canAccessLesson({ userId: "other@x.org", courseId: "gone" } as never, "helper@x.org")).toBe(false);
    expect(await canAccessCourseId("gone", "helper@x.org")).toBe(false);
  });
});
