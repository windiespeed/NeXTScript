import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { classroomPushSchema, readBody } from "@/lib/validation";
import { courseStore } from "@/lib/courseStore";
import { canAccessCourse } from "@/lib/access";
import { store } from "@/lib/store";
import { projectStore } from "@/lib/projectStore";
import { getOrCreateClassroomTopic, pushLessonToClassroom } from "@/lib/google";
import { classroomDecks, listLessonDecks } from "@/lib/lessonDecks";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    if ((session as any).error === "RefreshAccessTokenError") {
      return NextResponse.json({ error: "Your Google session has expired. Please sign out and sign in again." }, { status: 401 });
    }

    const accessToken = (session as any).accessToken as string | undefined;
    if (!accessToken) return NextResponse.json({ error: "No Google access token." }, { status: 401 });

    const parsed = await readBody(req, classroomPushSchema);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { lessonIds, courseId, moduleName } = parsed.data;

    const course = await courseStore.getById(courseId);
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    if (!canAccessCourse(course, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const classroomId = course.googleClassroomId;
    if (!classroomId) return NextResponse.json({ error: "No Google Classroom linked to this course." }, { status: 400 });

    // Get or create topic if a module name was provided
    let topicId: string | undefined;
    if (moduleName?.trim()) {
      try {
        topicId = await getOrCreateClassroomTopic(classroomId, moduleName.trim(), accessToken);
      } catch {
        // Non-fatal — proceed without topic
      }
    }

    // Fetch the owner's projects once to find quiz URLs (decks are looked up per lesson below)
    const allProjects = await projectStore.getAll(course.userId);

    const results: { lessonId: string; ok: boolean; error?: string; skipped?: string[] }[] = [];

    for (const lessonId of lessonIds) {
      try {
        const lesson = await store.getById(lessonId);
        if (!lesson) { results.push({ lessonId, ok: false, error: "Lesson not found" }); continue; }

        // Every exported deck of the lesson (a lesson can have several), newest first.
        const decks = classroomDecks(await listLessonDecks(lesson));
        const quiz = allProjects.find(p => p.type === "form" && p.isQuiz && (p.lessonId === lessonId || p.lessonIds?.includes(lessonId)) && p.url);
        const slidesUrls = decks.map(d => d.url);
        const docUrl = lesson.overviewUrl;
        const formUrl = quiz?.url;

        const description = lesson.overview || lesson.subtitle || undefined;

        const { skipped } = await pushLessonToClassroom({
          classroomId,
          title: lesson.title,
          description,
          topicId,
          slidesUrls,
          docUrl,
          formUrl,
          lessonType: lesson.lessonType,
          accessToken,
        });

        results.push({ lessonId, ok: true, ...(skipped.length ? { skipped } : {}) });
      } catch (e: any) {
        results.push({ lessonId, ok: false, error: e.message });
      }
    }

    const failed = results.filter(r => !r.ok);
    if (failed.length === lessonIds.length) {
      return NextResponse.json({ error: "All pushes failed.", results }, { status: 500 });
    }

    return NextResponse.json({ ok: true, pushed: results.filter(r => r.ok).length, failed: failed.length, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
