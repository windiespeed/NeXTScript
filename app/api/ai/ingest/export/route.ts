import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userSettings } from "@/lib/userSettings";
import { projectStore } from "@/lib/projectStore";
import { store } from "@/lib/store";
import { courseStore } from "@/lib/courseStore";
import { canAccessLesson, canAccessCourseId } from "@/lib/access";
import { buildSlideDeckFromAst } from "@/lib/google";
import { assertValidAst } from "@/lib/ingestionService";
import type { PresentationAST } from "@/types/slideAst";
import type { SavedProject } from "@/types/project";

export const dynamic = "force-dynamic";

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
    let lessonId: string | undefined;
    if (typeof body.lessonId === "string" && body.lessonId) {
      const lesson = await store.getById(body.lessonId);
      if (lesson && (await canAccessLesson(lesson, session.user.email))) lessonId = lesson.id;
    }
    let courseId: string | undefined;
    if (typeof body.courseId === "string" && body.courseId && (await canAccessCourseId(body.courseId, session.user.email))) {
      courseId = body.courseId;
    }

    // Template precedence mirrors app/api/generate/[id]/route.ts: request body → course default → user default.
    let templateId: string | undefined = typeof body.templateId === "string" && body.templateId ? body.templateId : undefined;
    if (!templateId && courseId) {
      const course = await courseStore.getById(courseId);
      if (course?.settings?.defaultTemplateUrl) templateId = extractPresentationId(course.settings.defaultTemplateUrl);
    }
    if (!templateId) {
      const settings = await userSettings.get(session.user.email);
      if (settings.defaultTemplateUrl) templateId = extractPresentationId(settings.defaultTemplateUrl);
    }

    const deckId = await buildSlideDeckFromAst(ast, accessToken, templateId);
    const url = `https://docs.google.com/presentation/d/${deckId}/edit`;

    const projectInput: Omit<SavedProject, "id" | "createdAt" | "userId"> = {
      type: "deck",
      title: ast.lessonTitle,
      subtitle: ast.targetAudience,
      url,
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
