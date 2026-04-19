import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { conceptStore } from "@/lib/conceptStore";
import { courseStore } from "@/lib/courseStore";
import { DEFAULT_JS_CONCEPTS } from "@/types/concept";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const body = await req.json();
    const courseId: string | undefined = body.courseId ?? body.classId;
    if (!courseId) return NextResponse.json({ error: "courseId is required." }, { status: 400 });
    const course = await courseStore.getById(courseId);
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    if ((course.teacherId ?? course.userId) !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const existing = await conceptStore.getByCourse(courseId);
    if (existing.length > 0) {
      return NextResponse.json({ error: "This course already has concepts. Delete them first to re-seed." }, { status: 400 });
    }
    const concepts = await conceptStore.createMany(DEFAULT_JS_CONCEPTS, session.user.email, courseId);
    return NextResponse.json(concepts, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
