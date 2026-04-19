import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { courseStore } from "@/lib/courseStore";
import type { CourseInput } from "@/types/course";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get("moduleId");
    const unassigned = searchParams.get("unassigned") === "true";

    let courses = await courseStore.getAll(session.user.email);
    if (moduleId) courses = courses.filter(c => c.moduleId === moduleId);
    else if (unassigned) courses = courses.filter(c => !c.moduleId);

    return NextResponse.json(courses);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const body: CourseInput = await req.json();
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    const course = await courseStore.create(body, session.user.email);
    return NextResponse.json(course, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
