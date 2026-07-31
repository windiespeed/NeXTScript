import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { courseStore } from "@/lib/courseStore";
import { canAccessCourse } from "@/lib/access";
import { createCourseFolder, shareCourseFolderWithMembers, hasDriveAccess } from "@/lib/google";

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

    // A folder already exists for this course (created by whoever hit this first, or by the
    // lazy-create path in the generate route) — repair its sharing instead of creating a
    // duplicate. Only whoever can already see it in their own Drive is able to grant access
    // to the rest of the course's members.
    if (course.driveFolderId) {
      const canSee = await hasDriveAccess(course.driveFolderId, accessToken);
      if (!canSee) {
        return NextResponse.json(
          { error: "You don't currently have Drive access to this course's folder. Ask whoever originally created it to open Course Settings and click this instead — only they can grant others access." },
          { status: 403 }
        );
      }
      await shareCourseFolderWithMembers(course.driveFolderId, course, session.user.email, accessToken);
      return NextResponse.json(course);
    }

    const folder = await createCourseFolder(course.title, accessToken);

    // Share the new folder with the owner and any other collaborators (best-effort) — whoever
    // is acting here owns the folder in their own Drive; everyone else needs explicit access.
    await shareCourseFolderWithMembers(folder.id, course, session.user.email, accessToken);

    const updated = await courseStore.update(id, {
      driveFolderId: folder.id,
      driveFolderUrl: folder.webViewLink,
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
