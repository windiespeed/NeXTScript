import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userSettings, getMergedLabels } from "@/lib/userSettings";
import { courseStore } from "@/lib/courseStore";
import { fillLesson } from "@/lib/ai";
import { DEFAULT_SECTION_LABELS } from "@/lib/sectionLabels";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const settings = await userSettings.get(session.user.email);
    const apiKey = settings.anthropicKey;
    if (!apiKey) {
      return NextResponse.json({ error: "No Anthropic API key configured. Add your key in Settings." }, { status: 402 });
    }

    const lesson = await req.json();

    // Fetch course settings if this lesson belongs to a course
    const course = lesson.courseId ? await courseStore.getById(lesson.courseId) : undefined;

    // Merge: defaults → user profile → course settings (course wins)
    const industry = (course?.settings?.industry || settings.industry) ?? "";
    const subject  = (course?.settings?.subject  || settings.subject)  ?? "";
    const labels = {
      ...DEFAULT_SECTION_LABELS,
      ...settings.sectionLabels,
      ...(course?.settings?.sectionLabels ?? {}),
    };

    const count = typeof lesson.slideCount === "number" ? Math.min(20, Math.max(1, lesson.slideCount)) : 10;
    const result = await fillLesson(apiKey, lesson, { industry, subject, labels }, count);
    return NextResponse.json(result);
  } catch (err: any) {
    // Surface Anthropic billing/auth errors clearly
    if (err.status === 401) return NextResponse.json({ error: "Invalid Anthropic API key." }, { status: 402 });
    if (err.status === 402) return NextResponse.json({ error: "Anthropic credits exhausted. Top up your account at console.anthropic.com." }, { status: 402 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
