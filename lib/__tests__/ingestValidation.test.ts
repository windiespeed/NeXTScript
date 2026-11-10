import { describe, expect, it } from "vitest";
import { hybridIngestSchema, ingestExportSchema, parseBody } from "@/lib/validation";

describe("hybridIngestSchema", () => {
  const base = { courseConfig: { courseId: "c1", anchors: [] }, rawNotes: "notes" };

  it("accepts the hybrid payload and normalizes optional context", () => {
    const r = parseBody(hybridIngestSchema, { ...base, targetAudience: "  ", lessonTitle: " Flexbox ", slideCount: 99, studentLevel: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.targetAudience).toBeUndefined();
    expect(r.data.lessonTitle).toBe("Flexbox");
    expect(r.data.slideCount).toBe(30);
    expect(r.data.studentLevel).toBeUndefined();
  });

  it("requires a course", () => {
    const r = parseBody(hybridIngestSchema, { ...base, courseConfig: { courseId: "" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("courseConfig.courseId");
  });

  it("rejects a bad student level and a missing notes field", () => {
    expect(parseBody(hybridIngestSchema, { ...base, studentLevel: "expert" }).ok).toBe(false);
    expect(parseBody(hybridIngestSchema, { courseConfig: { courseId: "c1" } }).ok).toBe(false);
  });
});

describe("ingestExportSchema", () => {
  it("rejects non-string ids", () => {
    expect(parseBody(ingestExportSchema, { ast: {}, lessonId: 5 }).ok).toBe(false);
    expect(parseBody(ingestExportSchema, { ast: {}, lessonId: "l1", courseId: null }).ok).toBe(true);
  });
});
