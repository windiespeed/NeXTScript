import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { courseStore } from "@/lib/courseStore";
import { isCourseOwner } from "@/lib/access";
import { stripProtected } from "@/lib/validation";
import type { Course } from "@/types/course";
import { serverError } from "@/lib/apiErrors";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const course = await courseStore.getById(id);
    if (!course) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!isCourseOwner(course, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    return NextResponse.json(course);
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const existing = await courseStore.getById(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!isCourseOwner(existing, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    // Legacy alias of PUT /api/courses/[id]. Collaborators are managed there (it also
    // updates Drive sharing), so they can't be changed through this route.
    const body = stripProtected(await req.json(), ["collaborators"]);
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    const updated = await courseStore.update(id, body as Partial<Course>);
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
    const existing = await courseStore.getById(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!isCourseOwner(existing, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    await courseStore.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
