import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { projectStore } from "@/lib/projectStore";
import { store } from "@/lib/store";
import { courseStore } from "@/lib/courseStore";
import { canAccessLesson, canAccessCourseId } from "@/lib/access";
import { buildSlideDeckFromAst, moveFileToFolder, autoDeckName } from "@/lib/google";
import { ensureLessonFolderId, ensureCourseFolderId } from "@/lib/lessonFolders";
import { assertValidAst } from "@/lib/ingestionService";
import { DEFAULT_THEME_ID } from "@/lib/themes";
import type { PresentationAST } from "@/types/slideAst";
import type { SavedProject } from "@/types/project";
import type { Lesson } from "@/types/lesson";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function extractPresentationId(url: string): string | undefined {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : undefined;
}

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
    const ast = body.ast as PresentationAST;

    // lessonId/courseId are optional — the ingest tool can still export standalone decks not
    // attached to a lesson. When present, verify the caller actually has access to them before
    // trusting them as join keys on the created SavedProject.
    let lesson: Lesson | undefined;
    if (typeof body.lessonId === "string" && body.lessonId) {
      const found = await store.getById(body.lessonId);
      if (found && (await canAccessLesson(found, session.user.email))) lesson = found;
    }
    const lessonId = lesson?.id;

    let courseId: string | undefined;
    if (typeof body.courseId === "string" && body.courseId && (await canAccessCourseId(body.courseId, session.user.email))) {
      courseId = body.courseId;
    }
    const course = courseId ? await courseStore.getById(courseId) : undefined;

    // Template: the course's own setting always wins. Only when the course has none configured
    // can the caller supply a one-off template for just this export — it's never persisted
    // anywhere (not to the course, not to the user), unlike the removed personal-default field.
    let templateId = course?.settings?.defaultTemplateUrl
      ? extractPresentationId(course.settings.defaultTemplateUrl)
      : undefined;
    if (!templateId && typeof body.templateUrl === "string" && body.templateUrl.trim()) {
      templateId = extractPresentationId(body.templateUrl.trim());
    }

    // Theme precedence: request body (whatever's picked in ThemePicker for this generation) →
    // course default → fixed global fallback. No user-level tier — a course either has a
    // branded default or every export uses the same theme, by design.
    const themeId: string = typeof body.themeId === "string" && body.themeId
      ? body.themeId
      : (course?.settings?.defaultThemeId || DEFAULT_THEME_ID);

    const deckId = await buildSlideDeckFromAst(ast, accessToken, templateId, themeId);

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

    const url = `https://docs.google.com/presentation/d/${deckId}/edit`;

    const projectInput: Omit<SavedProject, "id" | "createdAt" | "userId"> = {
      type: "deck",
      title: autoDeckName(lesson?.title, lesson?.subtitle),
      subtitle: ast.targetAudience,
      url,
      presentationAST: ast,
      ...(lessonId ? { lessonId } : {}),
      ...(courseId ? { courseId } : {}),
    };
    await projectStore.create(projectInput, session.user.email);

    return NextResponse.json({ url });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
