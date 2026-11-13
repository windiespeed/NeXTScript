import { courseStore } from "@/lib/courseStore";
import { canAccessCourse } from "@/lib/access";
import { getTheme } from "@/lib/themes";
import { resolveSlideAnchors, type SlideAnchor } from "@/lib/slideAnchors";
import type { Course } from "@/types/course";

export interface CourseSkeleton {
  course: Course;
  anchors: SlideAnchor[];
  /** Always a real theme id: the course's default if set and known, else the global default. */
  themeId: string;
}

/**
 * Server-side source of truth for a course's Notes to Slides skeleton. Returns null when the
 * course doesn't exist or `email` can't access it, so callers keep the same course scoping the
 * rest of the app uses (owner or collaborator). Anchors come from the course's own sections (built-in
 * defaults when it has none), exactly as the browser resolves them, so the screen and the server agree.
 */
export async function loadCourseSkeleton(courseId: string, email: string): Promise<CourseSkeleton | null> {
  const course = await courseStore.getById(courseId);
  if (!course || !canAccessCourse(course, email)) return null;
  return {
    course,
    anchors: resolveSlideAnchors(course),
    themeId: getTheme(course.settings?.defaultThemeId).id,
  };
}
