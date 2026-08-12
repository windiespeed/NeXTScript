import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { canAccessLesson, canAccessCourseId } from "@/lib/access";
import type { Lesson } from "@/types/lesson";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const lesson = await store.getById(id);
    if (!lesson) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!(await canAccessLesson(lesson, session.user.email))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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
    if (!(await canAccessLesson(existing, session.user.email))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const body: Partial<Lesson> = await req.json();
    // "courseId" omitted entirely = not touching it (most PUTs here are partial saves that never
    // mention course). Only reject an explicit attempt to clear it — every lesson must stay assigned.
    if ("courseId" in body && !body.courseId) {
      return NextResponse.json({ error: "Course is required — a lesson can't be unassigned." }, { status: 400 });
    }
    if (body.courseId && body.courseId !== existing.courseId) {
      if (!(await canAccessCourseId(body.courseId, session.user.email))) {
        return NextResponse.json({ error: "Forbidden: no access to the destination course." }, { status: 403 });
      }
    }
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
    if (!(await canAccessLesson(existing, session.user.email))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    await store.delete(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
