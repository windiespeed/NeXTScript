import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { courseStore } from "@/lib/courseStore";
import { canAccessCourse, isCourseOwner } from "@/lib/access";
import { getDb } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { shareDriveFile, revokeDriveAccess } from "@/lib/google";
import { serverError } from "@/lib/apiErrors";
import { coursePatchSchema, readBody } from "@/lib/validation";
import type { Course } from "@/types/course";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { id } = await params;
    const course = await courseStore.getById(id);
    if (!course) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!canAccessCourse(course, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

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
    const course = await courseStore.getById(id);
    if (!course) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!canAccessCourse(course, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    // The schema drops ownership and server-managed fields (id, userId, Drive folder, students).
    const parsed = await readBody(req, coursePatchSchema);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { collaborators, ...rest } = parsed.data;
    // Nulls clear a field (e.g. unlinking a classroom), as before.
    const patch = rest as Partial<Course>;
    const owner = isCourseOwner(course, session.user.email);

    if (collaborators !== undefined) {
      if (!owner) return NextResponse.json({ error: "Only the course owner can manage collaborators." }, { status: 403 });

      const before = new Set(course.collaborators ?? []);
      const after = Array.from(new Set(collaborators ?? []));
      const added = after.filter((e) => !before.has(e));
      const removed = Array.from(before).filter((e) => !after.includes(e));

      const accessToken = (session as any).accessToken as string | undefined;
      if (course.driveFolderId && accessToken) {
        await Promise.all([
          ...added.map((email) => shareDriveFile(course.driveFolderId!, email, accessToken).catch(() => {})),
          ...removed.map((email) => revokeDriveAccess(course.driveFolderId!, email, accessToken).catch(() => {})),
        ]);
      }
      patch.collaborators = after;
    }

    const updated = await courseStore.update(id, patch);
    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { id } = await params;
    const course = await courseStore.getById(id);
    if (!course) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!isCourseOwner(course, session.user.email)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    await courseStore.delete(id);

    // Clear courseId from all lessons that belonged to this course (owner's or any collaborator's)
    const db = getDb();
    const affected = await db.collection("lessons")
      .where("courseId", "==", id)
      .get();
    if (!affected.empty) {
      const batch = db.batch();
      affected.docs.forEach(doc => batch.update(doc.ref, { courseId: FieldValue.delete() }));
      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
