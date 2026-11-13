import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SectionDef } from "@/types/section";

type Legacy = { defaultSources?: string; industry?: string; subject?: string; sections?: SectionDef[]; sectionLabels?: Record<string, string> };
let settings: Legacy = {};
const save = vi.fn(async (_email: string, patch: Record<string, unknown>) => {
  for (const k of Object.keys(patch)) delete (settings as Record<string, unknown>)[k];
});
const update = vi.fn(async (id: string, patch: { settings: Record<string, unknown> }) => ({
  id, userId: "owner@x.org", settings: patch.settings,
}));

vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__delete__" } }));
vi.mock("@/lib/userSettings", () => ({ userSettings: { get: async () => ({ ...settings }), save } }));
vi.mock("@/lib/courseStore", () => ({ courseStore: { update } }));

const { carryOverProfileDefaults } = await import("@/lib/profileCarryOver");

const course = (id: string, userId: string, own: Record<string, unknown> = {}) =>
  ({ id, userId, settings: { defaultSources: "", industry: "", subject: "", sectionLabels: { vocabulary: "Vocabulary" }, ...own } }) as never;

const customSections: SectionDef[] = [
  { id: "lessonOverview", label: "Overview", position: "before-slides", includeInOverviewDoc: true, includeInQuizContext: true, skipIfEmpty: false },
] as SectionDef[];

describe("carryOverProfileDefaults", () => {
  beforeEach(() => {
    settings = {};
    save.mockClear();
    update.mockClear();
  });

  it("does nothing when no old Profile values are saved", async () => {
    const courses = [course("a", "owner@x.org")];
    expect(await carryOverProfileDefaults("owner@x.org", courses)).toBe(courses);
    expect(update).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("fills only owned courses that lack each value, then clears the old values", async () => {
    settings = { defaultSources: "https://mdn.dev", industry: "Healthcare", subject: "Nursing 101", sections: customSections };
    const result = await carryOverProfileDefaults("Owner@x.org", [
      course("empty", "owner@x.org"),
      course("has", "owner@x.org", { defaultSources: "https://keep.me", industry: "Coding", subject: "JS", sections: [{ id: "x" }] }),
      course("partial", "owner@x.org", { industry: "Business" }),
      course("shared", "someone@else.org"),
    ]);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith("empty", { settings: { defaultSources: "https://mdn.dev", industry: "Healthcare", subject: "Nursing 101", sections: customSections } });
    expect(update).toHaveBeenCalledWith("partial", { settings: { defaultSources: "https://mdn.dev", subject: "Nursing 101", sections: customSections } });
    expect(result.map((c) => (c as { id: string }).id)).toEqual(["empty", "has", "partial", "shared"]);
    expect(save).toHaveBeenCalledWith("Owner@x.org", { defaultSources: "__delete__", industry: "__delete__", subject: "__delete__", sections: "__delete__" });
  });

  it("merges old Profile section labels under the course's own labels", async () => {
    settings = { sectionLabels: { vocabulary: "Key Terms", warmUp: "Bell Ringer" } };
    await carryOverProfileDefaults("owner@x.org", [course("a", "owner@x.org")]);
    expect(update).toHaveBeenCalledWith("a", { settings: { sectionLabels: { vocabulary: "Vocabulary", warmUp: "Bell Ringer" } } });
  });

  it("keeps the old values until the user owns a course", async () => {
    settings = { industry: "Healthcare" };
    await carryOverProfileDefaults("owner@x.org", [course("shared", "someone@else.org")]);
    expect(update).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("clears empty old values without touching courses", async () => {
    settings = { defaultSources: "  ", industry: "", sections: [] };
    await carryOverProfileDefaults("owner@x.org", [course("a", "owner@x.org")]);
    expect(update).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith("owner@x.org", { defaultSources: "__delete__", industry: "__delete__", sections: "__delete__" });
  });
});
