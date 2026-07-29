import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exerciseStore } from "@/lib/exerciseStore";
import { courseStore } from "@/lib/courseStore";
import { canAccessCourse } from "@/lib/access";
import type { ExerciseInput, ExerciseConcept } from "@/types/exercise";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const concept = searchParams.get("concept") as ExerciseConcept | null;
    const courseId = searchParams.get("courseId");

    if (courseId) {
      const course = await courseStore.getById(courseId);
      if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
      if (!canAccessCourse(course, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      const exercises = await exerciseStore.getAllByCourse(courseId, concept ?? undefined);
      return NextResponse.json(exercises);
    }

    const exercises = await exerciseStore.getUnassigned(session.user.email);
    return NextResponse.json(exercises);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const body: ExerciseInput = await req.json();
    if (!body.title?.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    if (!body.courseId) return NextResponse.json({ error: "courseId is required." }, { status: 400 });
    const course = await courseStore.getById(body.courseId);
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    if (!canAccessCourse(course, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const exercise = await exerciseStore.create(body, session.user.email);
    return NextResponse.json(exercise, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
