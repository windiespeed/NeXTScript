import { NextResponse } from "next/server";
import { courseStore } from "@/lib/courseStore";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Public endpoint — no auth required.
 * Returns course info + released lessons only.
 * Used by the student view and MCA LMS integration.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const course = await courseStore.getById(id);
    if (!course) return NextResponse.json({ error: "Not found." }, { status: 404 });

    // Fetch all lessons in this course, return only released ones
    const allLessons = await store.getAll(course.userId, id);
    const releasedLessons = allLessons
      .filter((l) => l.released)
      .map(({ id, title, subtitle, topics, deadline, tag, status, folderUrl }) => ({
        id, title, subtitle, topics, deadline, tag, status, folderUrl,
      }));

    return NextResponse.json({
      id: course.id,
      title: course.title,
      description: course.description,
      gradeLevel: course.gradeLevel,
      term: course.term,
      subject: course.settings.subject,
      industry: course.settings.industry,
      lessons: releasedLessons,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
