import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exerciseStore } from "@/lib/exerciseStore";
import { courseStore } from "@/lib/courseStore";
import { canAccessCourse } from "@/lib/access";
import { SEED_EXERCISES } from "@/data/seed-exercises";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";
    const { courseId } = await req.json();
    if (!courseId) return NextResponse.json({ error: "courseId is required." }, { status: 400 });

    const course = await courseStore.getById(courseId);
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    if (!canAccessCourse(course, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    if (!force) {
      const alreadySeeded = await exerciseStore.hasSeededCourse(courseId);
      if (alreadySeeded) return NextResponse.json({ message: "Already seeded.", seeded: 0 });
    }

    await exerciseStore.createMany(SEED_EXERCISES, session.user.email, courseId);
    return NextResponse.json({ message: "Seeded successfully.", seeded: SEED_EXERCISES.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
