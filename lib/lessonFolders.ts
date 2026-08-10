import { store } from "@/lib/store";
import { courseStore } from "@/lib/courseStore";
import { createFolder, createCourseFolder, shareCourseFolderWithMembers, listClassroomTeacherEmails } from "@/lib/google";
import type { Lesson } from "@/types/lesson";
import type { Course } from "@/types/course";

function extractFolderId(url?: string): string | undefined {
  return url?.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1];
}

/**
 * Returns the course's Drive folder ID, creating and sharing one with every course member
 * (mirrors app/api/generate/[id]/route.ts's inline logic) if it doesn't have one yet.
 */
export async function ensureCourseFolderId(course: Course, accessToken: string, actingEmail: string): Promise<string> {
  if (course.driveFolderId) return course.driveFolderId;

  const folder = await createCourseFolder(course.title, accessToken);
  await courseStore.update(course.id, { driveFolderId: folder.id, driveFolderUrl: folder.webViewLink, driveFolderShared: true });

  // Whoever generates first owns this folder in their own Drive — share it with the rest of
  // the course's members, plus any co-teacher who only has access via Google Classroom.
  const classroomTeacherEmails = course.googleClassroomId
    ? await listClassroomTeacherEmails(course.googleClassroomId, accessToken)
    : [];
  await shareCourseFolderWithMembers(folder.id, course, actingEmail, accessToken, classroomTeacherEmails);

  return folder.id;
}

/**
 * Returns the lesson's Drive folder ID, creating one (nested under courseFolderId if given)
 * and persisting it on the lesson if it doesn't have one yet.
 */
export async function ensureLessonFolderId(
  lesson: Lesson,
  courseFolderId: string | undefined,
  accessToken: string
): Promise<string> {
  const existing = extractFolderId(lesson.folderUrl);
  if (existing) return existing;

  const folder = await createFolder(`${lesson.title}: ${lesson.subtitle}`, accessToken, courseFolderId);
  // Firestore rejects an explicit `undefined` value (no ignoreUndefinedProperties here), so
  // only persist the URL when Drive actually returned one — otherwise just skip the write.
  if (folder.webViewLink) {
    await store.update(lesson.id, { folderUrl: folder.webViewLink });
  }
  return folder.id!;
}
