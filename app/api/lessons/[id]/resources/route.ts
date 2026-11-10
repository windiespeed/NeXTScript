import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { lessonResourceCreateSchema, readBody } from "@/lib/validation";
import { store } from "@/lib/store";
import { canAccessLesson } from "@/lib/access";
import { v4 as uuidv4 } from "uuid";
import type { LessonResource } from "@/types/lesson";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const lesson = await store.getById(id);
  if (!lesson) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!(await canAccessLesson(lesson, session.user.email))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  return NextResponse.json(lesson.resources ?? []);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const lesson = await store.getById(id);
  if (!lesson) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!(await canAccessLesson(lesson, session.user.email))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const parsed = await readBody(req, lessonResourceCreateSchema);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const body = parsed.data;

  const resource: LessonResource = {
    id: uuidv4(),
    type: body.type,
    label: body.label,
    url: body.url,
    createdAt: new Date().toISOString(),
  };

  const resources = [...(lesson.resources ?? []), resource];
  await store.update(id, { resources });
  return NextResponse.json(resource);
}
