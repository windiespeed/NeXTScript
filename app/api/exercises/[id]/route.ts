import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exerciseStore } from "@/lib/exerciseStore";
import type { Exercise } from "@/types/exercise";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const exercise = await exerciseStore.getById(id);
    if (!exercise) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (exercise.userId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    return NextResponse.json(exercise);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const existing = await exerciseStore.getById(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.userId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const body: Partial<Exercise> = await req.json();
    const updated = await exerciseStore.update(id, body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const existing = await exerciseStore.getById(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.userId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    await exerciseStore.delete(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
