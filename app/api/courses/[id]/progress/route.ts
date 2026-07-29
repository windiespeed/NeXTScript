import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { courseStore } from "@/lib/courseStore";
import { canAccessCourse } from "@/lib/access";
import { exerciseStore } from "@/lib/exerciseStore";
import { getDb } from "@/lib/firebase";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const course = await courseStore.getById(id);
    if (!course) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!canAccessCourse(course, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const assignedConcepts: string[] = course.assignedConcepts ?? [];
    const courseExercises = await exerciseStore.getAllByCourse(course.id);
    const exercises = courseExercises.sort((a, b) => {
      const ai = assignedConcepts.indexOf(a.concept);
      const bi = assignedConcepts.indexOf(b.concept);
      if (ai !== bi) return ai - bi;
      if (a.concept !== b.concept) return a.concept.localeCompare(b.concept);
      return a.order - b.order;
    });

    const snap = await getDb().collection("student_progress").where("courseId", "==", id).get();
    const progress = snap.docs.map(d => d.data());

    return NextResponse.json({ course, exercises, progress });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
