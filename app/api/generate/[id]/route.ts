import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { projectStore } from "@/lib/projectStore";
import { courseStore } from "@/lib/courseStore";
import { userSettings, getMergedLabels } from "@/lib/userSettings";
import { generateBundleSelective, generateBundleAsDownload, buildQuiz } from "@/lib/google";
import { generateQuizQuestions } from "@/lib/ai";
import { DEFAULT_SECTION_LABELS } from "@/lib/sectionLabels";

export const dynamic = "force-dynamic";

type FileChoice = "slides" | "doc" | "quiz";
type Destination = "drive" | "download";

function extractPresentationId(url: string): string | undefined {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : undefined;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session) {
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

  // Parse body — fall back to "all files, drive" if body is absent (backwards compat)
  let files: FileChoice[] = ["slides", "doc", "quiz"];
  let destination: Destination = "drive";
  let templateId: string | undefined;
  try {
    const body = await req.json();
    if (Array.isArray(body.files) && body.files.length > 0) files = body.files;
    if (body.destination === "download") destination = "download";
    if (typeof body.templateId === "string" && body.templateId) templateId = body.templateId;
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

  // Course settings override user settings when non-empty
  const industry = (course?.settings?.industry || uSettings.industry) ?? "";
  const subject  = (course?.settings?.subject  || uSettings.subject)  ?? "";

  // Merge section labels: defaults → user labels → course labels
  const mergedLabels = {
    ...DEFAULT_SECTION_LABELS,
    ...uSettings.sectionLabels,
    ...(course?.settings?.sectionLabels ?? {}),
  };

  // If no templateId from the request, fall back to the course's default template URL
  if (!templateId && course?.settings?.defaultTemplateUrl) {
    templateId = extractPresentationId(course.settings.defaultTemplateUrl);
  }
  // Then fall back to the user's saved default template URL
  if (!templateId && uSettings.defaultTemplateUrl) {
    templateId = extractPresentationId(uSettings.defaultTemplateUrl);
  }

  const curriculumCtx = { industry, subject, labels: mergedLabels };

  try {
    if (destination === "drive") {
      // ── Slides + Doc ─────────────────────────────────────────────────────
      const bundleFiles = files.filter(f => f !== "quiz") as ("slides" | "doc")[];
      const { folderUrl, deckId, docId } = await generateBundleSelective(
        lesson,
        bundleFiles,
        accessToken,
        templateId,
        mergedLabels,
        course?.driveFolderId ?? undefined
      );

      // Save deck and overview doc as projects
      const overviewUrl = docId ? `https://docs.google.com/document/d/${docId}/edit` : undefined;
      await Promise.all([
        deckId ? projectStore.create({ type: "deck", lessonId: id, title: lesson.title, subtitle: lesson.subtitle, url: `https://docs.google.com/presentation/d/${deckId}/edit` }, session.user!.email!) : null,
      ]);

      // ── Quiz ──────────────────────────────────────────────────────────────
      if (files.includes("quiz")) {
        const allProjects = await projectStore.getAll(session.user!.email!);
        const quizDrafts = allProjects.filter(p =>
          p.type === "form" && p.status === "draft" &&
          (p.lessonId === id || (p.lessonIds?.includes(id) ?? false))
        );

        if (quizDrafts.length > 0) {
          // Generate each saved quiz draft to a Google Form
          for (const draft of quizDrafts) {
            try {
              const syntheticLesson = { ...lesson, quizQuestions: draft.questions ?? [] };
              const formId = await buildQuiz(syntheticLesson, accessToken);
              const formUrl = `https://docs.google.com/forms/d/${formId}/edit`;
              await projectStore.update(draft.id, { status: "generated", url: formUrl });
            } catch {
              // Non-fatal — continue with other drafts
            }
          }
        } else {
          // No draft exists — fall back to lesson's inline questions or AI auto-gen
          let lessonToGenerate = lesson;
          if (!lesson.quizQuestions?.length && uSettings.anthropicKey) {
            try {
              const aiQuestions = await generateQuizQuestions(uSettings.anthropicKey, lesson, curriculumCtx);
              lessonToGenerate = { ...lesson, quizQuestions: aiQuestions };
            } catch {
              // proceed with empty quiz
            }
          }
          if (lessonToGenerate.quizQuestions?.length) {
            try {
              const formId = await buildQuiz(lessonToGenerate, accessToken);
              const formUrl = `https://docs.google.com/forms/d/${formId}/edit`;
              // Delete any previously generated quizzes for this lesson before creating the new one
              const existingGenerated = allProjects.filter(p =>
                p.type === "form" && p.isQuiz &&
                (p.lessonId === id || (p.lessonIds?.includes(id) ?? false)) &&
                (p.status === "generated" || (!p.status && p.url))
              );
              await Promise.all(existingGenerated.map(p => projectStore.delete(p.id)));
              await projectStore.create({ type: "form", lessonId: id, title: lesson.title, subtitle: lesson.subtitle, isQuiz: true, status: "generated", url: formUrl }, session.user!.email!);
            } catch {
              // Non-fatal
            }
          }
        }
      }

      const updatePatch: Record<string, any> = { status: "done", folderUrl };
      if (overviewUrl) updatePatch.overviewUrl = overviewUrl;
      const updated = await store.update(id, updatePatch);
      return NextResponse.json(updated);
    } else {
      const downloadFiles = files.filter(f => f !== "quiz") as ("slides" | "doc")[];
      const downloads = await generateBundleAsDownload(lesson, downloadFiles, accessToken, templateId, mergedLabels);
      await store.update(id, { status: "done" });
      return NextResponse.json({ downloads });
    }
  } catch (err: any) {
    await store.update(id, { status: "error", errorMessage: err.message });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
