import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedProject } from "@/types/project";
import type { Lesson } from "@/types/lesson";
import type { PresentationAST } from "@/types/slideAst";

const projectUpdate = vi.fn(async (id: string, patch: Partial<SavedProject>) => ({ id, ...patch }));
const projectCreate = vi.fn(async (input: Omit<SavedProject, "id" | "createdAt" | "userId">, userId: string) => ({
  ...input, id: "new-draft", userId, createdAt: "2026-11-13T00:00:00.000Z",
}) as SavedProject);
const lessonUpdate = vi.fn(async () => null);

vi.mock("@/lib/projectStore", () => ({ projectStore: { update: projectUpdate, create: projectCreate } }));
vi.mock("@/lib/store", () => ({ store: { update: lessonUpdate } }));
vi.mock("@/lib/google", () => ({ autoDeckName: (t?: string) => t ?? "Slide Deck" }));

const { migrateLessonDecks, classroomDecks, uniqueDeckName } = await import("@/lib/lessonDecks");

const AST = { lessonTitle: "L", targetAudience: "Students", slides: [] } as unknown as PresentationAST;

function deck(id: string, createdAt: string, extra: Partial<SavedProject> = {}): SavedProject {
  return { id, userId: "a@x.org", type: "deck", title: "Lesson 1", url: `https://docs.google.com/presentation/d/${id}`, lessonId: "L1", createdAt, ...extra };
}

const lesson = (extra: Partial<Lesson> = {}) => ({ id: "L1", userId: "a@x.org", title: "Lesson 1", courseId: "C1", ...extra }) as Lesson;

beforeEach(() => {
  projectUpdate.mockClear();
  projectCreate.mockClear();
  lessonUpdate.mockClear();
});

describe("migrateLessonDecks", () => {
  it("keeps the newest old export as the deck and marks older exports as earlier versions", async () => {
    const out = await migrateLessonDecks(lesson(), [deck("a", "2026-11-01"), deck("c", "2026-11-03"), deck("b", "2026-11-02")]);
    expect(projectUpdate.mock.calls.map(c => c[0]).sort()).toEqual(["a", "b"]);
    expect(out.find(d => d.id === "c")?.earlierVersion).toBeFalsy();
    expect(lessonUpdate).toHaveBeenCalledWith("L1", expect.objectContaining({ decksMigrated: true }));
  });

  it("turns a draft saved on the lesson into its own draft deck", async () => {
    const out = await migrateLessonDecks(lesson({ presentationAST: AST, presentationStatus: "draft", slideNotes: "notes" }), [deck("a", "2026-11-01")]);
    expect(projectCreate).toHaveBeenCalledOnce();
    const draft = out[0];
    expect(draft).toMatchObject({ status: "draft", url: "", lessonId: "L1", courseId: "C1", slideNotes: "notes", presentationAST: AST });
  });

  it("does not copy a lesson deck that was already exported", async () => {
    await migrateLessonDecks(lesson({ presentationAST: AST, presentationStatus: "exported" }), [deck("a", "2026-11-01")]);
    expect(projectCreate).not.toHaveBeenCalled();
  });

  it("does nothing once migrated", async () => {
    await migrateLessonDecks(lesson({ decksMigrated: true }), [deck("a", "2026-11-01"), deck("b", "2026-11-02")]);
    expect(projectUpdate).not.toHaveBeenCalled();
    expect(lessonUpdate).not.toHaveBeenCalled();
  });
});

describe("classroomDecks", () => {
  it("attaches every exported deck but not drafts or earlier versions", () => {
    const decks = [
      deck("x", "1", { updatedAt: "3" }),
      deck("y", "2", { updatedAt: "2" }),
      deck("d", "1", { status: "draft", url: "" }),
      deck("old", "0", { earlierVersion: true }),
    ];
    expect(classroomDecks(decks).map(d => d.id)).toEqual(["x", "y"]);
  });
});

describe("uniqueDeckName", () => {
  it("numbers a new deck when the lesson already has one with that name", () => {
    expect(uniqueDeckName("Lesson 1", [])).toBe("Lesson 1");
    expect(uniqueDeckName("Lesson 1", [deck("a", "1")])).toBe("Lesson 1 (Deck 2)");
    expect(uniqueDeckName("Lesson 1", [deck("a", "1"), deck("b", "1", { title: "Lesson 1 (Deck 2)" })])).toBe("Lesson 1 (Deck 3)");
  });
});
