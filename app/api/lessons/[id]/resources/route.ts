import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { v4 as uuidv4 } from "uuid";
import type { LessonResource } from "@/types/lesson";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const lesson = await store.getById(id);
  if (!lesson) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (lesson.userId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  return NextResponse.json(lesson.resources ?? []);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const lesson = await store.getById(id);
  if (!lesson) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (lesson.userId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = await req.json() as { label: string; url: string; type: LessonResource["type"] };
  if (!body.label?.trim() || !body.url?.trim()) {
    return NextResponse.json({ error: "label and url are required." }, { status: 400 });
  }

  const resource: LessonResource = {
    id: uuidv4(),
    type: body.type ?? "link",
    label: body.label.trim(),
    url: body.url.trim(),
    createdAt: new Date().toISOString(),
  };

  const resources = [...(lesson.resources ?? []), resource];
  await store.update(id, { resources });
  return NextResponse.json(resource);
}
