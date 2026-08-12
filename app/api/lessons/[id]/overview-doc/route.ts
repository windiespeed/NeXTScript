import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { courseStore } from "@/lib/courseStore";
import { projectStore } from "@/lib/projectStore";
import { userSettings } from "@/lib/userSettings";
import { canAccessLesson, canAccessProject } from "@/lib/access";
import { buildOverviewDoc, deleteFile, extractDriveFileId, moveFileToFolder } from "@/lib/google";
import { ensureLessonFolderId, ensureCourseFolderId } from "@/lib/lessonFolders";
import { resolveSections } from "@/lib/sections";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Generates the lesson's Overview Doc from specifically selected decks/quizzes — single
 * instance per lesson, always deleting and replacing whatever was there before.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if ((session as any).error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Your Google session has expired. Please sign out and sign in again." }, { status: 401 });
  }
  const accessToken = (session as any).accessToken as string | undefined;
  if (!accessToken) return NextResponse.json({ error: "No Google access token. Please sign out and sign in again." }, { status: 401 });

  const lesson = await store.getById(id);
  if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  if (!(await canAccessLesson(lesson, session.user.email))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const deckIds: string[] = Array.isArray(body.deckIds) ? body.deckIds : [];
  const quizIds: string[] = Array.isArray(body.quizIds) ? body.quizIds : [];

  try {
    // Re-resolve the selected projects server-side and re-check access — never trust that a
    // client-supplied id actually belongs to this lesson or this user.
    const [decks, quizzes] = await Promise.all([
      Promise.all(deckIds.map(did => projectStore.getById(did))),
      Promise.all(quizIds.map(qid => projectStore.getById(qid))),
    ]);
    const selectedDecks = (await Promise.all(
      decks.filter((d): d is NonNullable<typeof d> => !!d && d.type === "deck")
        .map(async d => (await canAccessProject(d, session.user!.email!)) ? d : null)
    )).filter((d): d is NonNullable<typeof d> => !!d);
    const selectedQuizzes = (await Promise.all(
      quizzes.filter((q): q is NonNullable<typeof q> => !!q && q.type === "form")
        .map(async q => (await canAccessProject(q, session.user!.email!)) ? q : null)
    )).filter((q): q is NonNullable<typeof q> => !!q);

    const [uSettings, course] = await Promise.all([
      userSettings.get(session.user.email),
      lesson.courseId ? courseStore.getById(lesson.courseId) : Promise.resolve(undefined),
    ]);
    const sections = resolveSections({ course, userSettings: uSettings });

    // Delete the previous Overview Doc's Drive file before building the new one — this stays
    // single-instance per lesson, unlike decks/quizzes which now accumulate.
    if (lesson.overviewUrl) {
      const oldFileId = extractDriveFileId(lesson.overviewUrl);
      if (oldFileId) await deleteFile(oldFileId, accessToken).catch(() => {});
    }

    const docId = await buildOverviewDoc(lesson, accessToken, selectedDecks, selectedQuizzes, sections);

    try {
      const courseFolderId = course ? await ensureCourseFolderId(course, accessToken, session.user.email) : undefined;
      const lessonFolderId = await ensureLessonFolderId(lesson, courseFolderId, accessToken);
      await moveFileToFolder(docId, lessonFolderId, accessToken);
    } catch {
      // Non-fatal — the doc still exists at Drive's root.
    }

    const overviewUrl = `https://docs.google.com/document/d/${docId}/edit`;
    await store.update(id, { overviewUrl });

    return NextResponse.json({ url: overviewUrl });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
