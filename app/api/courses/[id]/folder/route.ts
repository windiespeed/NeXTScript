import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { courseStore } from "@/lib/courseStore";
import { canAccessCourse } from "@/lib/access";
import { createCourseFolder, shareCourseFolderWithMembers, hasDriveAccess, listClassroomTeacherEmails } from "@/lib/google";

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

    // Co-teachers who only have access via the linked Google Classroom (never added as a
    // NeXTScript collaborator) still need Drive access to this folder — pull them from the
    // Classroom roster so they're included alongside the app's own recorded members.
    const classroomTeacherEmails = course.googleClassroomId
      ? await listClassroomTeacherEmails(course.googleClassroomId, accessToken)
      : [];

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
      await shareCourseFolderWithMembers(course.driveFolderId, course, session.user.email, accessToken, classroomTeacherEmails);
      const repaired = await courseStore.update(id, { driveFolderShared: true });
      return NextResponse.json(repaired);
    }

    const folder = await createCourseFolder(course.title, accessToken);

    // Share the new folder with the owner, any other collaborators, and the Classroom roster
    // (best-effort) — whoever is acting here owns the folder in their own Drive; everyone
    // else needs explicit access.
    await shareCourseFolderWithMembers(folder.id, course, session.user.email, accessToken, classroomTeacherEmails);

    const updated = await courseStore.update(id, {
      driveFolderId: folder.id,
      driveFolderUrl: folder.webViewLink,
      driveFolderShared: true,
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
