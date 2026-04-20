import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { courseStore } from "@/lib/courseStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const courses = await courseStore.getAll(session.user.email);
    return NextResponse.json(courses);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const body = await req.json();
    const title = body.name?.trim() || body.title?.trim();
    if (!title) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    const course = await courseStore.create(
      {
        title,
        description: "",
        gradeLevel: "",
        term: "",
        settings: { defaultSources: "", defaultTemplateUrl: "", industry: "", subject: "", studentLevel: "", sectionLabels: { lessonOverview: "", learningTargets: "", vocabulary: "", warmUp: "", guidedLab: "", selfPaced: "", submissionChecklist: "", checkpoint: "", industryBestPractices: "", devJournalPrompt: "", rubric: "" } },
        lessonIds: [],
        language: body.language,
        progressMode: body.progressMode,
        solutionRevealAttempts: body.solutionRevealAttempts,
        assignedConcepts: body.assignedConcepts ?? [],
      },
      session.user.email
    );
    return NextResponse.json(course, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
