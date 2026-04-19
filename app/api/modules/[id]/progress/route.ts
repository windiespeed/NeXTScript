import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { classStore } from "@/lib/classStore";
import { exerciseStore } from "@/lib/exerciseStore";
import { getDb } from "@/lib/firebase";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const cls = await classStore.getById(id);
    if (!cls) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (cls.teacherId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const allExercises = await exerciseStore.getAll(session.user.email);
    const exercises = allExercises
      .filter(e => cls.assignedConcepts?.includes(e.concept))
      .sort((a, b) => {
        const ai = cls.assignedConcepts?.indexOf(a.concept) ?? 0;
        const bi = cls.assignedConcepts?.indexOf(b.concept) ?? 0;
        if (ai !== bi) return ai - bi;
        return a.order - b.order;
      });

    const snap = await getDb().collection("student_progress").where("classId", "==", id).get();
    const progress = snap.docs.map(d => d.data());

    return NextResponse.json({ cls, exercises, progress });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
