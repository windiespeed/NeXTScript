import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { projectStore } from "@/lib/projectStore";
import { courseStore } from "@/lib/courseStore";
import { canAccessLesson } from "@/lib/access";
import { userSettings } from "@/lib/userSettings";
import { generateBundleSelective, generateBundleAsDownload, buildQuiz, addFileToFolders, autoDeckName } from "@/lib/google";
import { ensureLessonFolderId, ensureCourseFolderId } from "@/lib/lessonFolders";
import { resolveSections } from "@/lib/sections";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Overview Doc isn't a bundle option — it needs a source-selection step (see
// app/lessons/[id]/page.tsx's dedicated Generate Overview Doc flow instead).
type FileChoice = "slides" | "quiz";
type Destination = "drive" | "download";

function extractPresentationId(url: string): string | undefined {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : undefined;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if ((session as any).error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Your Google session has expired. Please sign out and sign in again." }, { status: 401 });
  }

  const accessToken = (session as any).accessToken as string | undefined;
  if (!accessToken) {
    return NextResponse.json({ error: "No Google access token. Please sign out and sign in again." }, { status: 401 });
  }

  const lesson = await store.getById(id);
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }
  if (!(await canAccessLesson(lesson, session.user.email))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Parse body — fall back to "all files, drive" if body is absent (backwards compat)
  let files: FileChoice[] = ["slides", "quiz"];
  let destination: Destination = "drive";
  try {
    const body = await req.json();
    if (Array.isArray(body.files) && body.files.length > 0) files = body.files;
    if (body.destination === "download") destination = "download";
  } catch {
    // empty body — use defaults
  }

  const inProgressStatus = lesson.status === "done" ? "regenerating" : "generating";
  await store.update(id, { status: inProgressStatus });

  // Load user settings and course settings (if lesson belongs to a course)
  const [uSettings, course] = await Promise.all([
    userSettings.get(session.user!.email!),
    lesson.courseId ? courseStore.getById(lesson.courseId) : Promise.resolve(undefined),
  ]);

  // Ensure the course has a Drive folder so slides/docs/quizzes all land in one place
  let courseFolderId = course?.driveFolderId;
  if (course && !courseFolderId && destination === "drive") {
    courseFolderId = await ensureCourseFolderId(course, accessToken, session.user!.email!);
  }

  // Resolve the active section list: course-level > user-level > synthesized from labels
  // (defaults → user labels → course labels), so old courses/users behave identically.
  const sections = resolveSections({ course, userSettings: uSettings });

  // Template comes from the course's own settings only — no personal/account-level override.
  const templateId = course?.settings?.defaultTemplateUrl
    ? extractPresentationId(course.settings.defaultTemplateUrl)
    : undefined;

  try {
    if (destination === "drive") {
      // ── Slides ────────────────────────────────────────────────────────────
      const bundleFiles: ("slides")[] = files.includes("slides") ? ["slides"] : [];
      const { folderUrl, folderId: lessonFolderId, deckId } = await generateBundleSelective(
        lesson,
        bundleFiles,
        accessToken,
        templateId,
        sections,
        courseFolderId
      );

      // Save deck as a project
      await Promise.all([
        deckId ? projectStore.create({
          type: "deck",
          lessonId: id,
          title: autoDeckName(lesson.title, lesson.subtitle),
          subtitle: lesson.subtitle,
          url: `https://docs.google.com/presentation/d/${deckId}/edit`,
          slideContent: lesson.slideContent,
        }, session.user!.email!) : null,
      ]);

      // ── Quiz ──────────────────────────────────────────────────────────────
      // Requires an existing quiz draft — this bundle action only pushes already-drafted
      // questions to a Google Form, it never writes quiz content itself. Picking which
      // lessons/modules a quiz covers is what the dedicated Quiz pages are for.
      if (files.includes("quiz")) {
        const allProjects = await projectStore.getAll(session.user!.email!);
        const quizDrafts = allProjects.filter(p =>
          p.type === "form" && p.status === "draft" &&
          (p.lessonId === id || (p.lessonIds?.includes(id) ?? false))
        );

        for (const draft of quizDrafts) {
          try {
            const syntheticLesson = { ...lesson, quizQuestions: draft.questions ?? [] };
            // Home folder is this lesson's own Drive folder (same one slides/doc just landed in),
            // not the course-level folder — matches where the rest of the lesson's files live.
            const formId = await buildQuiz(syntheticLesson, accessToken, lessonFolderId);

            // A quiz covering multiple lessons also gets added to each *other* lesson's own folder.
            if (draft.lessonIds && draft.lessonIds.length > 1) {
              const otherLessonIds = draft.lessonIds.filter(lessonId => lessonId !== id);
              const lessonFolderIds: string[] = [];
              for (const lessonId of otherLessonIds) {
                const otherLesson = await store.getById(lessonId);
                if (otherLesson) lessonFolderIds.push(await ensureLessonFolderId(otherLesson, courseFolderId, accessToken));
              }
              await addFileToFolders(formId, lessonFolderIds, accessToken).catch(() => {});
            }

            const formUrl = `https://docs.google.com/forms/d/${formId}/edit`;
            await projectStore.update(draft.id, { status: "generated", url: formUrl });
          } catch {
            // Non-fatal — continue with other drafts
          }
        }
      }

      const updated = await store.update(id, { status: "done", folderUrl });
      return NextResponse.json(updated);
    } else {
      const downloadFiles: ("slides")[] = files.includes("slides") ? ["slides"] : [];
      const downloads = await generateBundleAsDownload(lesson, downloadFiles, accessToken, templateId, sections);
      await store.update(id, { status: "done" });
      return NextResponse.json({ downloads });
    }
  } catch (err: any) {
    const errMsg = typeof err?.message === "string" ? err.message : String(err?.message ?? err);
    await store.update(id, { status: "error", errorMessage: errMsg });
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
