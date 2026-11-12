import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readBody, seedSchema } from "@/lib/validation";
import { exerciseStore } from "@/lib/exerciseStore";
import { courseStore } from "@/lib/courseStore";
import { canAccessCourse } from "@/lib/access";
import { SEED_EXERCISES } from "@/data/seed-exercises";
import { serverError } from "@/lib/apiErrors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const parsed = await readBody(req, seedSchema);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const courseId = parsed.data.courseId ?? parsed.data.classId;
    if (!courseId) return NextResponse.json({ error: "courseId is required." }, { status: 400 });

    const course = await courseStore.getById(courseId);
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    if (!canAccessCourse(course, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    // Once per course: seeding again would add a second copy of every starter exercise.
    const alreadySeeded = await exerciseStore.hasSeededCourse(courseId);
    if (alreadySeeded) return NextResponse.json({ message: "Already seeded.", seeded: 0 });

    await exerciseStore.createMany(SEED_EXERCISES, session.user.email, courseId);
    return NextResponse.json({ message: "Seeded successfully.", seeded: SEED_EXERCISES.length });
  } catch (err) {
    return serverError(err);
  }
}
