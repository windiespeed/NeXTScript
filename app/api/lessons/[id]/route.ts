import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import type { Lesson } from "@/types/lesson";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const lesson = await store.getById(id);
    if (!lesson) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (lesson.userId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    return NextResponse.json(lesson);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const existing = await store.getById(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.userId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const body: Partial<Lesson> = await req.json();
    const updated = await store.update(id, body);
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
    const existing = await store.getById(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.userId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    await store.delete(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
