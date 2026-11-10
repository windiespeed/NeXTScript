import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { courseStore } from "@/lib/courseStore";
import { DEFAULT_COURSE_SETTINGS } from "@/types/course";
import { serverError } from "@/lib/apiErrors";
import { legacyModuleCreateSchema, readBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const courses = await courseStore.getAll(session.user.email);
    return NextResponse.json(courses);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const parsed = await readBody(req, legacyModuleCreateSchema);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const body = parsed.data;
    const title = body.name?.trim() || body.title?.trim();
    if (!title) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    const course = await courseStore.create(
      {
        title,
        description: "",
        gradeLevel: "",
        term: "",
        // Was previously an inline object with every sectionLabels value blanked out, which
        // shallow-merge-overrode DEFAULT_COURSE_SETTINGS' nice defaults with empty strings —
        // courses created here ended up with blank section labels everywhere. Use the real
        // defaults instead.
        settings: DEFAULT_COURSE_SETTINGS,
        lessonIds: [],
        language: body.language ?? undefined,
        progressMode: body.progressMode ?? undefined,
        solutionRevealAttempts: body.solutionRevealAttempts,
        assignedConcepts: body.assignedConcepts ?? [],
      },
      session.user.email
    );
    return NextResponse.json(course, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
