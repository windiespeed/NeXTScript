import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { courseStore } from "@/lib/courseStore";
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
    if (course.userId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const allExercises = await exerciseStore.getAll(session.user.email);
    const exercises = allExercises
      .filter(e => course.assignedConcepts?.includes(e.concept))
      .sort((a, b) => {
        const ai = course.assignedConcepts?.indexOf(a.concept) ?? 0;
        const bi = course.assignedConcepts?.indexOf(b.concept) ?? 0;
        if (ai !== bi) return ai - bi;
        return a.order - b.order;
      });

    const snap = await getDb().collection("student_progress").where("courseId", "==", id).get();
    const progress = snap.docs.map(d => d.data());

    return NextResponse.json({ course, exercises, progress });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
