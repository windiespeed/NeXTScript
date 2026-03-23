import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { projectStore } from "@/lib/projectStore";
import type { FormQuestion } from "@/types/form";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const projects = await projectStore.getAll(session.user.email);
  const quizzes = projects.filter(p => p.type === "form" && p.isQuiz);
  return NextResponse.json(quizzes);
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { title, lessonIds, moduleId, courseId, questions } = await req.json() as {
      title: string;
      lessonIds: string[];
      moduleId?: string;
      courseId?: string;
      questions: FormQuestion[];
    };

    if (!title?.trim()) return NextResponse.json({ error: "Quiz title is required." }, { status: 400 });
    if (!questions?.length) return NextResponse.json({ error: "Add at least one question." }, { status: 400 });

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
      ...(moduleId ? { moduleId } : {}),
      ...(courseId ? { courseId } : {}),
    }, session.user.email);

    return NextResponse.json({ id: project.id, status: "draft" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
