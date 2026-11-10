import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { projectStore } from "@/lib/projectStore";
import { canAccessCourseId, getAccessibleProjects } from "@/lib/access";
import { quizCreateSchema, readBody } from "@/lib/validation";
import { serverError } from "@/lib/apiErrors";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const projects = await getAccessibleProjects(session.user.email);
  const quizzes = projects.filter(p => p.type === "form" && p.isQuiz);
  return NextResponse.json(quizzes);
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const parsed = await readBody(req, quizCreateSchema);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { title, lessonIds, moduleId, courseId, questions } = parsed.data;
    if (!(await canAccessCourseId(courseId, session.user.email))) {
      return NextResponse.json({ error: "Forbidden: no access to this course." }, { status: 403 });
    }

    // Save as a draft — no Google Form is created yet.
    // Generation happens when the user hits Generate on the lesson hub page.
    const project = await projectStore.create({
      type: "form",
      isQuiz: true,
      status: "draft",
      title,
      url: "",              // populated on generation
      questions,
      lessonIds: lessonIds ?? [],
      courseId,
      ...(moduleId ? { moduleId } : {}),
    }, session.user.email);

    return NextResponse.json({ id: project.id, status: "draft" });
  } catch (err) {
    return serverError(err);
  }
}
