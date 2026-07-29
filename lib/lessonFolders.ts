import { store } from "@/lib/store";
import { createFolder } from "@/lib/google";
import type { Lesson } from "@/types/lesson";

function extractFolderId(url?: string): string | undefined {
  return url?.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1];
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
