import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { courseStore } from "@/lib/courseStore";
import { canAccessCourse } from "@/lib/access";
import type { LessonInput } from "@/types/lesson";
import { serverError } from "@/lib/apiErrors";
import { lessonCreateSchema, readBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");

    if (courseId) {
      const course = await courseStore.getById(courseId);
      if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
      if (!canAccessCourse(course, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      const lessons = await store.getAllByCourse(courseId);
      return NextResponse.json(lessons);
    }

    const lessons = await store.getAll(session.user.email);
    return NextResponse.json(lessons);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const parsed = await readBody(req, lessonCreateSchema);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const body = parsed.data as LessonInput & { courseId: string };

    const course = await courseStore.getById(body.courseId);
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    if (!canAccessCourse(course, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const lesson = await store.create(body, session.user.email);
    await courseStore.addLesson(body.courseId, lesson.id);
    return NextResponse.json(lesson, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
