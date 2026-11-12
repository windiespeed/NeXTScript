import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { courseStore } from "@/lib/courseStore";
import type { CourseInput } from "@/types/course";
import { courseCreateSchema, readBody } from "@/lib/validation";
import { serverError } from "@/lib/apiErrors";
import { carryOverUserSources } from "@/lib/sourcesCarryOver";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get("moduleId");
    const unassigned = searchParams.get("unassigned") === "true";

    let courses = await courseStore.getAll(session.user.email);
    // One-time move of the old Profile-wide AI sources into the user's own courses.
    try {
      courses = await carryOverUserSources(session.user.email, courses);
    } catch (err) {
      console.error("[courses] sources carry-over failed", err);
    }
    if (moduleId) courses = courses.filter(c => c.moduleId === moduleId);
    else if (unassigned) courses = courses.filter(c => !c.moduleId);

    return NextResponse.json(courses);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const parsed = await readBody(req, courseCreateSchema);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const course = await courseStore.create(parsed.data as CourseInput, session.user.email);
    return NextResponse.json(course, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
