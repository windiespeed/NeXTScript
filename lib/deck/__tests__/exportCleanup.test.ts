import { describe, expect, it, vi, beforeEach } from "vitest";

const calls = { copied: 0, deleted: [] as string[] };
const batchUpdate = vi.fn();

vi.mock("googleapis", () => {
  class OAuth2 {
    setCredentials() {}
  }
  return {
    google: {
      auth: { OAuth2 },
      drive: () => ({
        files: {
          copy: async () => {
            calls.copied++;
            return { data: { id: "copy-1" } };
          },
          delete: async ({ fileId }: { fileId: string }) => {
            calls.deleted.push(fileId);
            return {};
          },
        },
      }),
      slides: () => ({
        presentations: {
          get: async () => ({ data: { slides: [], layouts: [], masters: [], pageSize: { width: { magnitude: 9144000 }, height: { magnitude: 5143500 } } } }),
          batchUpdate,
        },
      }),
    },
  };
});

import { exportDeckToGoogleSlides, presentationIdFromUrl } from "@/lib/deck/render/googleSlides";
import { SAMPLE_DECK } from "@/lib/deck/sample";
import { getTheme } from "@/lib/themes";

describe("template export cleanup", () => {
  beforeEach(() => {
    calls.copied = 0;
    calls.deleted = [];
    batchUpdate.mockReset();
  });

  it("deletes the half-built copy when filling it fails", async () => {
    batchUpdate.mockRejectedValue(Object.assign(new Error("quota"), { code: 429 }));
    await expect(
      exportDeckToGoogleSlides({ deck: SAMPLE_DECK, theme: getTheme(undefined), name: "x", accessToken: "t", templateId: "tpl" }),
    ).rejects.toThrow("quota");
    expect(calls.copied).toBe(1);
    expect(calls.deleted).toEqual(["copy-1"]);
  });

  it("keeps the copy when the export succeeds", async () => {
    batchUpdate.mockResolvedValue({});
    const res = await exportDeckToGoogleSlides({ deck: SAMPLE_DECK, theme: getTheme(undefined), name: "x", accessToken: "t", templateId: "tpl" });
    expect(res.id).toBe("copy-1");
    expect(calls.deleted).toEqual([]);
  });

  it("only reads template ids from Google Slides links", () => {
    expect(presentationIdFromUrl("https://docs.google.com/document/d/abc/edit")).toBeUndefined();
    expect(presentationIdFromUrl("https://docs.google.com/presentation/d/abc/edit")).toBe("abc");
  });
});
