import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { projectStore } from "@/lib/projectStore";
import { canAccessProject, canAccessCourseId } from "@/lib/access";
import { projectPatchSchema, readBody } from "@/lib/validation";
import type { SavedProject } from "@/types/project";
import { deleteFile, extractDriveFileId } from "@/lib/google";

async function getAuthed(id: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not authenticated.", status: 401 } as const;
  const project = await projectStore.getById(id);
  if (!project) return { error: "Not found.", status: 404 } as const;
  if (!(await canAccessProject(project, session.user.email))) return { error: "Forbidden.", status: 403 } as const;
  const accessToken = (session as any).accessToken as string | undefined;
  return { project, email: session.user.email, accessToken };
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
  // The schema drops ownership fields and the ones only the generate routes write (url, type, status).
  const parsed = await readBody(req, projectPatchSchema);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const patch = parsed.data;

  // "courseId" omitted entirely = not touching it. Only reject an explicit attempt to clear it —
  // quizzes, decks, and docs must all stay assigned to a course.
  if ("courseId" in patch && !patch.courseId) {
    return NextResponse.json({ error: "Course is required — this can't be unassigned." }, { status: 400 });
  }
  if (patch.courseId && patch.courseId !== result.project.courseId) {
    if (!(await canAccessCourseId(patch.courseId, result.email))) {
      return NextResponse.json({ error: "Forbidden: no access to the destination course." }, { status: 403 });
    }
  }

  const updated = await projectStore.update(id, patch as Partial<SavedProject>);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAuthed(id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  // Best-effort — the Drive file is a courtesy cleanup, not the source of truth. A stale
  // access token or an already-deleted file shouldn't block removing our own record.
  if (result.accessToken && result.project.url) {
    const fileId = extractDriveFileId(result.project.url);
    if (fileId) await deleteFile(fileId, result.accessToken).catch(() => {});
  }

  await projectStore.delete(id);
  return NextResponse.json({ ok: true });
}
