import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exerciseStore } from "@/lib/exerciseStore";
import type { ExerciseInput, ExerciseConcept } from "@/types/exercise";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const concept = searchParams.get("concept") as ExerciseConcept | null;
    const exercises = await exerciseStore.getAll(session.user.email, concept ?? undefined);
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
    const exercise = await exerciseStore.create(body, session.user.email);
    return NextResponse.json(exercise, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
