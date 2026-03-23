import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { projectStore } from "@/lib/projectStore";
import { buildQuiz } from "@/lib/google";
import type { FormQuestion } from "@/types/form";
import type { Lesson } from "@/types/lesson";

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

    const accessToken = (session as any).accessToken as string | undefined;
    if (!accessToken) return NextResponse.json({ error: "No Google access token. Please sign out and sign in again." }, { status: 401 });

    const { title, lessonIds, moduleId, courseId, questions } = await req.json() as {
      title: string;
      lessonIds: string[];
      moduleId?: string;
      courseId?: string;
      questions: FormQuestion[];
    };

    if (!title?.trim()) return NextResponse.json({ error: "Quiz title is required." }, { status: 400 });
    if (!questions?.length) return NextResponse.json({ error: "Add at least one question." }, { status: 400 });

    // Build a synthetic lesson object — buildQuiz reads title, subtitle, and quizQuestions
    const syntheticLesson = {
      id: "quiz-builder",
      userId: session.user.email,
      title,
      subtitle: "",
      topics: "", deadline: "", tag: "", notes: "", overview: "", learningTargets: "",
      vocabulary: "", warmUp: "", slideContent: "", guidedLab: "", selfPaced: "",
      submissionChecklist: "", checkpoint: "", industryBestPractices: "",
      devJournalPrompt: "", rubric: "", sources: "",
      status: "done" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      quizQuestions: questions,
    } as Lesson;

    const formId = await buildQuiz(syntheticLesson, accessToken);
    const url = `https://docs.google.com/forms/d/${formId}/edit`;

    const project = await projectStore.create({
      type: "form",
      isQuiz: true,
      title,
      url,
      lessonIds: lessonIds ?? [],
      moduleId,
      courseId,
    }, session.user.email);

    return NextResponse.json({ id: project.id, url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
