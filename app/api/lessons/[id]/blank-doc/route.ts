import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { courseStore } from "@/lib/courseStore";
import { canAccessLesson } from "@/lib/access";
import { createBlankFile } from "@/lib/google";
import { ensureCourseFolderId, ensureLessonFolderId } from "@/lib/lessonFolders";
import { v4 as uuidv4 } from "uuid";
import type { LessonResource } from "@/types/lesson";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const accessToken = (session as any).accessToken as string | undefined;
  if (!accessToken) return NextResponse.json({ error: "No Google access token. Please sign out and sign in again." }, { status: 401 });

  const lesson = await store.getById(id);
  if (!lesson) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!(await canAccessLesson(lesson, session.user.email))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { name, docType } = await req.json() as { name: string; docType: "doc" | "sheet" | "slides" };
  if (!name?.trim()) return NextResponse.json({ error: "name is required." }, { status: 400 });
  if (!["doc", "sheet", "slides"].includes(docType)) return NextResponse.json({ error: "Invalid docType." }, { status: 400 });

  // Best-effort — if folder setup fails, the file is created at Drive root instead, same as
  // before this fix. The course's "Repair Drive Access" action can pick it up later.
  let lessonFolderId: string | undefined;
  try {
    const course = lesson.courseId ? await courseStore.getById(lesson.courseId) : undefined;
    const courseFolderId = course ? await ensureCourseFolderId(course, accessToken, session.user.email) : undefined;
    lessonFolderId = await ensureLessonFolderId(lesson, courseFolderId, accessToken);
  } catch {
    // fall through with lessonFolderId left undefined
  }

  const { id: driveId, url } = await createBlankFile(name.trim(), docType, accessToken, lessonFolderId);

  const resource: LessonResource = {
    id: uuidv4(),
    type: docType,
    label: name.trim(),
    url,
    driveId,
    createdAt: new Date().toISOString(),
  };

  const resources = [...(lesson.resources ?? []), resource];
  await store.update(id, { resources });
  return NextResponse.json(resource);
}
