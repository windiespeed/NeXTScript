import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { conceptStore } from "@/lib/conceptStore";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const existing = await conceptStore.getById(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.teacherId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const body = await req.json();
    const updated = await conceptStore.update(id, body);
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
    const existing = await conceptStore.getById(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (existing.teacherId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    await conceptStore.delete(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
