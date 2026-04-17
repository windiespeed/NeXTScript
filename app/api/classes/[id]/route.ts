import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { classStore } from "@/lib/classStore";
import type { Class } from "@/types/class";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const cls = await classStore.getById(id);
    if (!cls) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (cls.teacherId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    return NextResponse.json(cls);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const existing = await classStore.getById(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.teacherId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const body: Partial<Class> = await req.json();
    const updated = await classStore.update(id, body);
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
    const existing = await classStore.getById(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.teacherId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    await classStore.delete(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
