import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { projectStore } from "@/lib/projectStore";
import { courseStore } from "@/lib/courseStore";
import { store } from "@/lib/store";
import { canAccessProject } from "@/lib/access";
import { buildQuiz, createCourseFolder, addFileToFolders } from "@/lib/google";
import { ensureLessonFolderId } from "@/lib/lessonFolders";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if ((session as any).error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Your Google session has expired. Please sign out and sign in again." }, { status: 401 });
  }

  const accessToken = (session as any).accessToken as string | undefined;
  if (!accessToken) return NextResponse.json({ error: "No Google access token." }, { status: 401 });

  const quiz = await projectStore.getById(id);
  if (!quiz) return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  if (!(await canAccessProject(quiz, session.user.email))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  if (!quiz.questions?.length) {
    return NextResponse.json({ error: "Quiz has no questions. Add questions before generating." }, { status: 400 });
  }

  try {
    // Resolve course Drive folder, creating it if it doesn't exist yet
    const courseId = quiz.courseId;
    let course = courseId ? await courseStore.getById(courseId) : undefined;
    let folderId = course?.driveFolderId ?? undefined;
    if (course && !folderId) {
      const folder = await createCourseFolder(course.title, accessToken);
      await courseStore.update(course.id, { driveFolderId: folder.id, driveFolderUrl: folder.webViewLink });
      folderId = folder.id;
    }

    const syntheticLesson = { title: quiz.title ?? "Quiz", quizQuestions: quiz.questions };
    const formId = await buildQuiz(syntheticLesson as any, accessToken, folderId);

    // A quiz linked to one or more lessons also gets added to each of those lessons' own
    // folders, in addition to the course folder, so it shows up wherever a teacher browses for it.
    const linkedLessonIds = quiz.lessonIds?.length ? quiz.lessonIds : (quiz.lessonId ? [quiz.lessonId] : []);
    if (linkedLessonIds.length > 0) {
      const lessonFolderIds: string[] = [];
      for (const lessonId of linkedLessonIds) {
        const lesson = await store.getById(lessonId);
        if (lesson) lessonFolderIds.push(await ensureLessonFolderId(lesson, folderId, accessToken));
      }
      await addFileToFolders(formId, lessonFolderIds, accessToken).catch(() => {});
    }

    const url = `https://docs.google.com/forms/d/${formId}/edit`;
    await projectStore.update(id, { status: "generated", url });
    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
