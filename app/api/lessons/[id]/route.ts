import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { Lesson } from "@/types/lesson";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await store.getById(id);
  if (!lesson) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(lesson);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: Partial<Lesson> = await req.json();
  const updated = await store.update(id, body);
  if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await store.delete(id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
