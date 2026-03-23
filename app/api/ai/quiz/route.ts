import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userSettings } from "@/lib/userSettings";
import { courseStore } from "@/lib/courseStore";
import { generateQuizQuestions } from "@/lib/ai";
import { DEFAULT_SECTION_LABELS } from "@/lib/sectionLabels";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const settings = await userSettings.get(session.user.email);
    if (!settings.anthropicKey)
      return NextResponse.json({ error: "No Anthropic API key configured. Add your key in Profile." }, { status: 402 });

    const body = await req.json();
    const { lesson, mcCount, saCount, courseId } = body as {
      lesson: Record<string, any>;
      mcCount?: number;
      saCount?: number;
      courseId?: string;
    };

    const course = courseId ? await courseStore.getById(courseId) : undefined;
    const industry = (course?.settings?.industry || settings.industry) ?? "";
    const subject  = (course?.settings?.subject  || settings.subject)  ?? "";
    const labels = {
      ...DEFAULT_SECTION_LABELS,
      ...settings.sectionLabels,
      ...(course?.settings?.sectionLabels ?? {}),
    };

    const mc = Math.min(50, Math.max(0, mcCount ?? 8));
    const sa = Math.min(50, Math.max(0, saCount ?? 2));
    if (mc + sa === 0)
      return NextResponse.json({ error: "Please set at least 1 question." }, { status: 400 });
    const questions = await generateQuizQuestions(settings.anthropicKey, lesson, { industry, subject, labels }, mc, sa);

    if (questions.length === 0)
      return NextResponse.json({ error: "AI failed to generate questions. Try adding more topic detail." }, { status: 500 });

    return NextResponse.json(questions);
  } catch (err: any) {
    if (err.status === 401) return NextResponse.json({ error: "Invalid Anthropic API key." }, { status: 402 });
    if (err.status === 402) return NextResponse.json({ error: "Anthropic credits exhausted. Top up your account at console.anthropic.com." }, { status: 402 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
