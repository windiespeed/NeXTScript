import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { LessonInput } from "@/types/lesson";
import { aiQuizSchema, readBody } from "@/lib/validation";
import { userSettings } from "@/lib/userSettings";
import { resolveProgramContext } from "@/lib/programContext";
import { courseStore } from "@/lib/courseStore";
import { canAccessCourse } from "@/lib/access";
import { generateQuizQuestions } from "@/lib/ai";
import { resolveSections } from "@/lib/sections";
import { courseAiInputs } from "@/lib/courseAiInputs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const settings = await userSettings.get(session.user.email);
    if (!settings.anthropicKey)
      return NextResponse.json({ error: "No Anthropic API key configured. Add your key in Profile." }, { status: 402 });

    const parsed = await readBody(req, aiQuizSchema);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { lesson, mcCount, saCount, courseId } = parsed.data;

    const rawCourse = courseId ? await courseStore.getById(courseId) : undefined;
    const course = rawCourse && canAccessCourse(rawCourse, session.user.email) ? rawCourse : undefined;
    const { industry, subject } = resolveProgramContext(course, settings);
    const sections = resolveSections({ course, userSettings: settings });

    const mc = Math.min(50, Math.max(0, mcCount ?? 8));
    const sa = Math.min(50, Math.max(0, saCount ?? 2));
    if (mc + sa === 0)
      return NextResponse.json({ error: "Please set at least 1 question." }, { status: 400 });
    // Student Level comes from Course Settings only, never from the lessons.
    const { studentLevel } = courseAiInputs(course);
    const questions = await generateQuizQuestions(settings.anthropicKey, { ...lesson, studentLevel } as Partial<LessonInput>, { industry, subject, sections }, mc, sa);

    if (questions.length === 0)
      return NextResponse.json({ error: "AI failed to generate questions. Try adding more topic detail." }, { status: 500 });

    return NextResponse.json(questions);
  } catch (err: any) {
    if (err.status === 401) return NextResponse.json({ error: "Invalid Anthropic API key." }, { status: 402 });
    if (err.status === 402) return NextResponse.json({ error: "Anthropic credits exhausted. Top up your account at console.anthropic.com." }, { status: 402 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
