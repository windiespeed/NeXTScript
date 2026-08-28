import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { courseStore } from "@/lib/courseStore";
import { projectStore } from "@/lib/projectStore";
import { canAccessCourse } from "@/lib/access";
import {
  createCourseFolder, shareCourseFolderWithMembers, hasDriveAccess, listClassroomTeacherEmails,
  moveFileToFolder, extractDriveFileId,
} from "@/lib/google";
import { ensureLessonFolderId } from "@/lib/lessonFolders";
import type { SavedProject } from "@/types/project";
import type { Course } from "@/types/course";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Reconciles a course's Drive footprint after sharing/re-sharing its folder. Two separate gaps
 * mean a lesson can look fully generated in the app while its actual documents are invisible to
 * collaborators: (1) classic-pipeline decks didn't set `courseId` before this fix, so they never
 * showed up in a collaborator's project list at all, and (2) several generation paths move files
 * into the course/lesson folder tree as a best-effort, silently-caught step — a failure there
 * leaves the file sitting in the original creator's Drive root, outside the folder anyone else
 * was actually granted access to. This backfills (1) and re-attempts (2) for everything the
 * acting user currently has Drive access to; anything they were never granted access to is
 * reported as a failure rather than fixed (only the file's owner can move it).
 */
async function repairCourseFiles(courseId: string, courseFolderId: string, accessToken: string) {
  const lessons = await store.getAllByCourse(courseId);
  const lessonIds = lessons.map(l => l.id);

  const [byCourseId, byLessonId] = await Promise.all([
    projectStore.getAllForCourseIds([courseId]),
    projectStore.getAllForLessonIds(lessonIds),
  ]);
  const projectsById = new Map<string, SavedProject>();
  for (const p of [...byCourseId, ...byLessonId]) projectsById.set(p.id, p);
  const projects = Array.from(projectsById.values());

  let projectsBackfilled = 0, filesMoved = 0;
  const failures: { label: string; reason: string }[] = [];

  function recordFailure(label: string, err: unknown) {
    const reason = err instanceof Error ? err.message : String(err);
    failures.push({ label, reason });
    console.error(`[repairCourseFiles] ${label}: ${reason}`);
  }

  await Promise.all(
    projects.filter(p => !p.courseId).map(async p => {
      try {
        await projectStore.update(p.id, { courseId });
        projectsBackfilled++;
      } catch (err) {
        recordFailure(`backfill courseId on "${p.title}"`, err);
      }
    })
  );

  async function tryMove(fileId: string | undefined, folderId: string, label: string) {
    if (!fileId) return;
    try {
      await moveFileToFolder(fileId, folderId, accessToken);
      filesMoved++;
    } catch (err) {
      recordFailure(label, err);
    }
  }

  await Promise.all(lessons.map(async lesson => {
    let lessonFolderId: string;
    try {
      lessonFolderId = await ensureLessonFolderId(lesson, courseFolderId, accessToken);
      await moveFileToFolder(lessonFolderId, courseFolderId, accessToken);
    } catch (err) {
      recordFailure(`lesson folder for "${lesson.title}"`, err);
      return;
    }

    const ownProjects = projects.filter(p => p.lessonId === lesson.id && p.url);
    await Promise.all([
      tryMove(lesson.overviewUrl ? extractDriveFileId(lesson.overviewUrl) : undefined, lessonFolderId, `"${lesson.title}" overview doc`),
      ...(lesson.resources ?? []).filter(r => r.driveId).map(r => tryMove(r.driveId, lessonFolderId, `"${lesson.title}" resource "${r.label}"`)),
      ...ownProjects.map(p => tryMove(extractDriveFileId(p.url), lessonFolderId, `"${lesson.title}" project "${p.title}"`)),
    ]);
  }));

  // Course/module-scoped quizzes (multi-lesson, no single lessonId) belong at the course level.
  const courseLevelProjects = projects.filter(p => !p.lessonId && p.url);
  await Promise.all(courseLevelProjects.map(p => tryMove(extractDriveFileId(p.url), courseFolderId, `course-level project "${p.title}"`)));

  return { projectsBackfilled, filesMoved, filesFailed: failures.length, failures: failures.slice(0, 20) };
}

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

    let folderId: string;
    let responseBase: Course | null;

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
      folderId = course.driveFolderId;
      responseBase = await courseStore.update(id, { driveFolderShared: true });
    } else {
      const folder = await createCourseFolder(course.title, accessToken);

      // Share the new folder with the owner, any other collaborators, and the Classroom roster
      // (best-effort) — whoever is acting here owns the folder in their own Drive; everyone
      // else needs explicit access.
      await shareCourseFolderWithMembers(folder.id, course, session.user.email, accessToken, classroomTeacherEmails);

      folderId = folder.id;
      responseBase = await courseStore.update(id, {
        driveFolderId: folder.id,
        driveFolderUrl: folder.webViewLink,
        driveFolderShared: true,
      });
    }

    const repairSummary = await repairCourseFiles(id, folderId, accessToken);
    return NextResponse.json({ ...responseBase, ...repairSummary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
