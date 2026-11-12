import { beforeEach, describe, expect, it, vi } from "vitest";

const settings: { defaultSources?: string } = {};
const save = vi.fn(async (_email: string, patch: Record<string, unknown>) => {
  if ("defaultSources" in patch) delete settings.defaultSources;
});
const update = vi.fn(async (id: string, patch: { settings: { defaultSources: string } }) => ({
  id, userId: "owner@x.org", settings: { defaultSources: patch.settings.defaultSources },
}));

vi.mock("firebase-admin/firestore", () => ({ FieldValue: { delete: () => "__delete__" } }));
vi.mock("@/lib/userSettings", () => ({ userSettings: { get: async () => ({ ...settings }), save } }));
vi.mock("@/lib/courseStore", () => ({ courseStore: { update } }));

const { carryOverUserSources } = await import("@/lib/sourcesCarryOver");

const course = (id: string, userId: string, defaultSources = "") =>
  ({ id, userId, settings: { defaultSources } }) as never;

describe("carryOverUserSources", () => {
  beforeEach(() => {
    delete settings.defaultSources;
    save.mockClear();
    update.mockClear();
  });

  it("does nothing when no old sources are saved", async () => {
    const courses = [course("a", "owner@x.org")];
    expect(await carryOverUserSources("owner@x.org", courses)).toBe(courses);
    expect(update).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("fills only owned courses with no sources, then clears the old value", async () => {
    settings.defaultSources = "https://mdn.dev";
    const result = await carryOverUserSources("Owner@x.org", [
      course("empty", "owner@x.org"),
      course("has", "owner@x.org", "https://keep.me"),
      course("shared", "someone@else.org"),
    ]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("empty", { settings: { defaultSources: "https://mdn.dev" } });
    expect(result.map((c) => (c as { settings: { defaultSources: string } }).settings.defaultSources))
      .toEqual(["https://mdn.dev", "https://keep.me", ""]);
    expect(save).toHaveBeenCalledWith("Owner@x.org", { defaultSources: "__delete__" });
  });

  it("keeps the old value until the user owns a course", async () => {
    settings.defaultSources = "https://mdn.dev";
    await carryOverUserSources("owner@x.org", [course("shared", "someone@else.org")]);
    expect(update).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("clears an empty old value without touching courses", async () => {
    settings.defaultSources = "  ";
    await carryOverUserSources("owner@x.org", [course("a", "owner@x.org")]);
    expect(update).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
