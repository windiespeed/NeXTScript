import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { courseStore } from "@/lib/courseStore";
import { canAccessCourse } from "@/lib/access";
import { createCourseFolder, shareDriveFile } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    if ((session as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Google session expired. Please sign out and sign in again." }, { status: 401 });

    const accessToken = (session as any).accessToken as string | undefined;
    if (!accessToken)
      return NextResponse.json({ error: "No Google access token. Please sign out and sign in again." }, { status: 401 });

    const { id } = await params;
    const course = await courseStore.getById(id);
    if (!course) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!canAccessCourse(course, session.user.email))
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const folder = await createCourseFolder(course.title, accessToken);

    // Share the new folder with any existing collaborators (best-effort)
    if (course.collaborators?.length) {
      await Promise.all(
        course.collaborators.map((email) => shareDriveFile(folder.id, email, accessToken).catch(() => {}))
      );
    }

    const updated = await courseStore.update(id, {
      driveFolderId: folder.id,
      driveFolderUrl: folder.webViewLink,
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
