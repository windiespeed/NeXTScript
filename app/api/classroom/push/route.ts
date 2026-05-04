import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { courseStore } from "@/lib/courseStore";
import { store } from "@/lib/store";
import { projectStore } from "@/lib/projectStore";
import { getOrCreateClassroomTopic, pushLessonToClassroom } from "@/lib/google";

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

    const { lessonIds, courseId, moduleName } = await req.json() as {
      lessonIds: string[];
      courseId: string;
      moduleName?: string;
    };

    if (!Array.isArray(lessonIds) || lessonIds.length === 0) {
      return NextResponse.json({ error: "No lessons specified." }, { status: 400 });
    }

    const course = await courseStore.getById(courseId);
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    if (course.userId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

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

    // Fetch all projects once to find slides URLs
    const allProjects = await projectStore.getAll(session.user.email);

    const results: { lessonId: string; ok: boolean; error?: string }[] = [];

    for (const lessonId of lessonIds) {
      try {
        const lesson = await store.getById(lessonId);
        if (!lesson) { results.push({ lessonId, ok: false, error: "Lesson not found" }); continue; }

        const deck = allProjects.find(p => p.type === "deck" && (p.lessonId === lessonId || p.lessonIds?.includes(lessonId)));
        const quiz = allProjects.find(p => p.type === "form" && p.isQuiz && (p.lessonId === lessonId || p.lessonIds?.includes(lessonId)) && p.url);
        const slidesUrl = deck?.url;
        const docUrl = lesson.overviewUrl;
        const formUrl = quiz?.url;

        const description = lesson.overview || lesson.subtitle || undefined;

        await pushLessonToClassroom({
          classroomId,
          title: lesson.title,
          description,
          topicId,
          slidesUrl,
          docUrl,
          formUrl,
          lessonType: lesson.lessonType,
          accessToken,
        });

        results.push({ lessonId, ok: true });
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
