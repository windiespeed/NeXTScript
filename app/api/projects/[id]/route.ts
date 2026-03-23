import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { projectStore } from "@/lib/projectStore";

async function getAuthed(id: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated.", status: 401 } as const;
  const project = await projectStore.getById(id);
  if (!project) return { error: "Not found.", status: 404 } as const;
  if (project.userId !== session.user.email) return { error: "Forbidden.", status: 403 } as const;
  return { project };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAuthed(id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.project);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAuthed(id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const patch = await req.json();
  const updated = await projectStore.update(id, patch);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAuthed(id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  await projectStore.delete(id);
  return NextResponse.json({ ok: true });
}
