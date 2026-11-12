import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { LessonInput } from "@/types/lesson";
import { aiLessonSchema, readBody } from "@/lib/validation";
import { userSettings } from "@/lib/userSettings";
import { resolveProgramContext } from "@/lib/programContext";
import { courseStore } from "@/lib/courseStore";
import { canAccessCourse } from "@/lib/access";
import { fillLesson } from "@/lib/ai";
import { resolveSections } from "@/lib/sections";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const settings = await userSettings.get(session.user.email);
    const apiKey = settings.anthropicKey;
    if (!apiKey) {
      return NextResponse.json({ error: "No Anthropic API key configured. Add your key in Settings." }, { status: 402 });
    }

    const parsed = await readBody(req, aiLessonSchema);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const lesson = parsed.data;

    // Fetch course settings if this lesson belongs to a course the caller can access
    const rawCourse = lesson.courseId ? await courseStore.getById(lesson.courseId) : undefined;
    const course = rawCourse && canAccessCourse(rawCourse, session.user.email) ? rawCourse : undefined;

    // Merge: defaults → user profile → course settings (course wins)
    const { industry, subject } = resolveProgramContext(course, settings);
    const sections = resolveSections({ course, userSettings: settings });

    const result = await fillLesson(apiKey, lesson as Partial<LessonInput>, { industry, subject, sections });
    return NextResponse.json(result);
  } catch (err: any) {
    // Surface Anthropic billing/auth errors clearly
    if (err.status === 401) return NextResponse.json({ error: "Invalid Anthropic API key." }, { status: 402 });
    if (err.status === 402) return NextResponse.json({ error: "Anthropic credits exhausted. Top up your account at console.anthropic.com." }, { status: 402 });
    const msg = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
