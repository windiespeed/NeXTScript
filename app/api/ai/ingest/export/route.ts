import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { projectStore } from "@/lib/projectStore";
import { store } from "@/lib/store";
import { canAccessLesson } from "@/lib/access";
import { loadCourseSkeleton } from "@/lib/courseSkeleton";
import { applySlideAnchors } from "@/lib/slideAnchors";
import { uploadPptxToDrive, moveFileToFolder, autoDeckName } from "@/lib/google";
import { buildPptxFromAst } from "@/lib/pptxDeck";
import { ensureLessonFolderId, ensureCourseFolderId } from "@/lib/lessonFolders";
import { assertValidAst } from "@/lib/ingestionPrompt";
import { DEFAULT_THEME_ID, THEMES } from "@/lib/themes";
import type { PresentationAST } from "@/types/slideAst";
import type { SavedProject } from "@/types/project";
import type { Lesson } from "@/types/lesson";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    if ((session as any).error === "RefreshAccessTokenError") {
      return NextResponse.json({ error: "Your Google session has expired. Please sign out and sign in again." }, { status: 401 });
    }
    const accessToken = (session as any).accessToken as string | undefined;
    if (!accessToken) {
      return NextResponse.json({ error: "No Google access token. Please sign out and sign in again." }, { status: 401 });
    }

    const body = await req.json();

    // Re-validate the client-supplied AST — it was ours moments ago, but we're about to spend
    // real Google API calls building a Drive file from it, so don't trust the shape blindly.
    try {
      assertValidAst(body.ast);
    } catch {
      return NextResponse.json({ error: "Invalid slide data — please regenerate and try again." }, { status: 400 });
    }
    const clientAst = body.ast as PresentationAST;

    // lessonId/courseId are optional — the ingest tool can still export standalone decks not
    // attached to a lesson. When present, verify the caller actually has access to them before
    // trusting them as join keys on the created SavedProject.
    let lesson: Lesson | undefined;
    if (typeof body.lessonId === "string" && body.lessonId) {
      const found = await store.getById(body.lessonId);
      if (found && (await canAccessLesson(found, session.user.email))) lesson = found;
    }
    const lessonId = lesson?.id;

    // Fall back to the attached lesson's own course so a deck exported from a lesson still gets
    // that course's skeleton. loadCourseSkeleton re-checks access either way.
    const requestedCourseId = typeof body.courseId === "string" && body.courseId ? body.courseId : lesson?.courseId;
    const skeleton = requestedCourseId ? await loadCourseSkeleton(requestedCourseId, session.user.email) : null;
    const course = skeleton?.course;
    const courseId = course?.id;

    // Same locked anchors as the preview: re-apply them to the (possibly hand-edited) deck so the
    // .pptx carries the exact course section headings, in course order. A no-op on a deck that
    // already conforms, which is the normal case since the editor locks anchored slides.
    const ast = skeleton ? applySlideAnchors(clientAst, skeleton.anchors).ast : clientAst;

    // The deck's own theme wins (it's what the preview showed), then the course default.
    const themeId = THEMES.some(t => t.id === ast.themeId) ? ast.themeId! : skeleton?.themeId ?? DEFAULT_THEME_ID;
    const finalAst: PresentationAST = { ...ast, themeId };
    const buffer = await buildPptxFromAst(finalAst, themeId);
    const { id: deckId, webViewLink } = await uploadPptxToDrive(buffer, autoDeckName(lesson?.title, lesson?.subtitle), accessToken);

    // File the deck the same place the classic lesson generator would — nested in the lesson's
    // Drive folder (itself nested in the course's folder) — instead of leaving it at Drive's root.
    // Best-effort: the deck already exists and its URL is already known, so a Drive hiccup here
    // shouldn't lose track of it.
    try {
      if (lesson) {
        const courseFolderId = course ? await ensureCourseFolderId(course, accessToken, session.user.email) : undefined;
        const lessonFolderId = await ensureLessonFolderId(lesson, courseFolderId, accessToken);
        await moveFileToFolder(deckId, lessonFolderId, accessToken);
      } else if (course) {
        const courseFolderId = await ensureCourseFolderId(course, accessToken, session.user.email);
        await moveFileToFolder(deckId, courseFolderId, accessToken);
      }
    } catch {
      // Non-fatal — the deck still exists at Drive's root; export succeeds either way.
    }

    const url = webViewLink;

    const projectInput: Omit<SavedProject, "id" | "createdAt" | "userId"> = {
      type: "deck",
      title: autoDeckName(lesson?.title, lesson?.subtitle),
      subtitle: ast.targetAudience,
      url,
      presentationAST: finalAst,
      ...(lessonId ? { lessonId } : {}),
      ...(courseId ? { courseId } : {}),
    };
    await projectStore.create(projectInput, session.user.email);

    // The lesson keeps the finalized hybrid deck and its theme as its source of truth, so the
    // web view and the exported file stay in step and a later re-export starts from the same JSON.
    if (lessonId) {
      await store.update(lessonId, { presentationAST: finalAst, selectedTheme: themeId, presentationStatus: "exported" });
    }

    return NextResponse.json({ url, ast: finalAst });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
