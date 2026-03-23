import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const lesson = await store.getById(id);
  if (!lesson) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (lesson.userId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const resources = (lesson.resources ?? []).filter(r => r.id !== rid);
  await store.update(id, { resources });
  return NextResponse.json({ ok: true });
}
