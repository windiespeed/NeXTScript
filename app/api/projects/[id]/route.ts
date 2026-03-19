import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { projectStore } from "@/lib/projectStore";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const project = await projectStore.getById(id);
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (project.userId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  await projectStore.delete(id);
  return NextResponse.json({ ok: true });
}
