import type { Course } from "@/types/course";
import type { Lesson } from "@/types/lesson";
import type { SavedProject } from "@/types/project";
import type { Concept } from "@/types/concept";
import type { Exercise } from "@/types/exercise";
import { courseStore } from "@/lib/courseStore";
import { projectStore } from "@/lib/projectStore";

/** True if email is the course owner or one of its collaborators. */
export function canAccessCourse(course: Course, email: string): boolean {
  const e = email.toLowerCase();
  return course.userId.toLowerCase() === e || (course.collaborators ?? []).some((c) => c.toLowerCase() === e);
}

/** True if email is the course owner. Only owners may delete a course or manage collaborators. */
export function isCourseOwner(course: Course, email: string): boolean {
  return course.userId.toLowerCase() === email.toLowerCase();
}

/** True if email owns the lesson directly, or has access to the course it belongs to. */
export async function canAccessLesson(lesson: Lesson, email: string): Promise<boolean> {
  const e = email.toLowerCase();
  if (lesson.userId.toLowerCase() === e) return true;
  if (!lesson.courseId) return false;
  const course = await courseStore.getById(lesson.courseId);
  return course ? canAccessCourse(course, e) : false;
}

/** email's own projects (decks/quizzes) plus every project belonging to any course they can access (owned or collaborator). */
export async function getAccessibleProjects(email: string): Promise<SavedProject[]> {
  const [own, courses] = await Promise.all([
    projectStore.getAll(email),
    courseStore.getAll(email),
  ]);
  const accessibleCourseIds = courses.map((c) => c.id);
  const fromCourses = await projectStore.getAllForCourseIds(accessibleCourseIds);

  const byId = new Map<string, SavedProject>();
  for (const p of [...own, ...fromCourses]) byId.set(p.id, p);
  return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** True if email owns the project directly, or has access to the course it belongs to. */
export async function canAccessProject(project: SavedProject, email: string): Promise<boolean> {
  const e = email.toLowerCase();
  if (project.userId.toLowerCase() === e) return true;
  if (!project.courseId) return false;
  const course = await courseStore.getById(project.courseId);
  return course ? canAccessCourse(course, e) : false;
}

/** True if email is the concept's teacher, or has access to the course it belongs to. */
export async function canAccessConcept(concept: Concept, email: string): Promise<boolean> {
  const e = email.toLowerCase();
  if (concept.teacherId.toLowerCase() === e) return true;
  if (!concept.courseId) return false;
  const course = await courseStore.getById(concept.courseId);
  return course ? canAccessCourse(course, e) : false;
}

/** True if email owns the exercise directly, or has access to the course it belongs to. */
export async function canAccessExercise(exercise: Exercise, email: string): Promise<boolean> {
  const e = email.toLowerCase();
  if (exercise.userId.toLowerCase() === e) return true;
  if (!exercise.courseId) return false;
  const course = await courseStore.getById(exercise.courseId);
  return course ? canAccessCourse(course, e) : false;
}

/** True if email has access to the course identified by courseId (used to validate courseId reassignment targets). */
export async function canAccessCourseId(courseId: string, email: string): Promise<boolean> {
  const course = await courseStore.getById(courseId);
  return course ? canAccessCourse(course, email) : false;
}
