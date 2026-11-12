import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { courseStore } from "@/lib/courseStore";
import { canAccessLesson, canAccessCourseId } from "@/lib/access";
import type { Lesson } from "@/types/lesson";
import { lessonPatchSchema, parsePatch } from "@/lib/validation";
import { serverError } from "@/lib/apiErrors";

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
  } catch (err) {
    return serverError(err);
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
    const parsed = parsePatch(lessonPatchSchema, await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const body = parsed.data as Partial<Lesson>;
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
  } catch (err) {
    return serverError(err);
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
    // Keep the course's lesson order and modules from pointing at a lesson that no longer exists.
    if (existing.courseId) await courseStore.removeLesson(existing.courseId, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
