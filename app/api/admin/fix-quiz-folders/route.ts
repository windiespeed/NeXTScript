import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { projectStore } from "@/lib/projectStore";
import { courseStore } from "@/lib/courseStore";
import { store } from "@/lib/store";
import { createCourseFolder, moveFileToFolder, addFileToFolders } from "@/lib/google";
import { ensureLessonFolderId } from "@/lib/lessonFolders";
import type { SavedProject } from "@/types/project";

export const dynamic = "force-dynamic";

function extractFormId(url: string): string | undefined {
  return url.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/)?.[1];
}

/** Distinct course IDs referenced by a quiz's linked lesson(s), when the quiz has no courseId of its own. */
async function resolveCandidateCourseIds(quiz: SavedProject): Promise<string[]> {
  const lessonIds = quiz.lessonId ? [quiz.lessonId] : (quiz.lessonIds ?? []);
  const courseIds = new Set<string>();
  for (const lid of lessonIds) {
    const lesson = await store.getById(lid);
    if (lesson?.courseId) courseIds.add(lesson.courseId);
  }
  return Array.from(courseIds);
}

/**
 * Dry-run check (no writes, no Drive calls): reports any generated quizzes whose course
 * can't be resolved unambiguously — either no lesson has a courseId, or its lessons span
 * more than one course. Lets you review before running the actual fix below.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const allProjects = await projectStore.getAll(session.user.email);
    const quizzes = allProjects.filter(p => p.type === "form" && p.isQuiz && p.status === "generated" && p.url);

    const ambiguous: { id: string; title: string; courseIds: string[] }[] = [];
    const unresolvable: { id: string; title: string }[] = [];

    for (const quiz of quizzes) {
      if (quiz.courseId) continue; // has a definitive course already, nothing to check
      const courseIds = await resolveCandidateCourseIds(quiz);
      if (courseIds.length === 0) unresolvable.push({ id: quiz.id, title: quiz.title });
      else if (courseIds.length > 1) ambiguous.push({ id: quiz.id, title: quiz.title, courseIds });
    }

    return NextResponse.json({ checked: quizzes.length, ambiguous, unresolvable });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * One-time cleanup: moves already-generated quizzes (that were created before the
 * course-folder threading fix) into their course's Drive folder. Scoped to the
 * caller's own quizzes/courses since Drive moves must run under the account that
 * owns the file. Quizzes whose course can't be resolved unambiguously are skipped
 * rather than guessed at — use the GET dry-run above to review those first.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    if ((session as any).error === "RefreshAccessTokenError") {
      return NextResponse.json({ error: "Your Google session has expired. Please sign out and sign in again." }, { status: 401 });
    }
    const accessToken = (session as any).accessToken as string | undefined;
    if (!accessToken) return NextResponse.json({ error: "No Google access token. Please sign out and sign in again." }, { status: 401 });

    const allProjects = await projectStore.getAll(session.user.email);
    const quizzes = allProjects.filter(p => p.type === "form" && p.isQuiz && p.status === "generated" && p.url);

    let moved = 0;
    let skipped = 0;
    let failed = 0;
    let ambiguousCount = 0;
    const folderCache = new Map<string, string>(); // courseId -> driveFolderId

    for (const quiz of quizzes) {
      try {
        let courseId = quiz.courseId;
        if (!courseId) {
          const candidates = await resolveCandidateCourseIds(quiz);
          if (candidates.length > 1) { ambiguousCount++; skipped++; continue; }
          courseId = candidates[0];
        }
        if (!courseId) { skipped++; continue; }

        let folderId = folderCache.get(courseId);
        if (!folderId) {
          const course = await courseStore.getById(courseId);
          if (!course) { skipped++; continue; }
          folderId = course.driveFolderId;
          if (!folderId) {
            const folder = await createCourseFolder(course.title, accessToken);
            await courseStore.update(course.id, { driveFolderId: folder.id, driveFolderUrl: folder.webViewLink });
            folderId = folder.id;
          }
          folderCache.set(courseId, folderId);
        }

        const formId = extractFormId(quiz.url);
        if (!formId) { skipped++; continue; }

        await moveFileToFolder(formId, folderId, accessToken);

        // Quizzes covering multiple lessons also get added to each of those lessons'
        // own folders, in addition to the course folder.
        if (quiz.lessonIds && quiz.lessonIds.length > 1) {
          const lessonFolderIds: string[] = [];
          for (const lessonId of quiz.lessonIds) {
            const lesson = await store.getById(lessonId);
            if (lesson) lessonFolderIds.push(await ensureLessonFolderId(lesson, folderId, accessToken));
          }
          await addFileToFolders(formId, lessonFolderIds, accessToken).catch(() => {});
        }

        moved++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ checked: quizzes.length, moved, skipped, failed, ambiguousCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
