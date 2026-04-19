import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { conceptStore } from "@/lib/conceptStore";
import type { ConceptInput } from "@/types/concept";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const classId = searchParams.get("classId");
    const concepts = courseId
      ? await conceptStore.getByCourse(courseId)
      : classId
        ? await conceptStore.getByClass(classId)
        : await conceptStore.getAll(session.user.email);
    return NextResponse.json(concepts);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const body: ConceptInput & { courseId?: string; classId?: string } = await req.json();
    if (!body.slug?.trim() || !body.label?.trim()) {
      return NextResponse.json({ error: "Slug and label are required." }, { status: 400 });
    }
    const courseId = body.courseId ?? body.classId;
    if (!courseId) {
      return NextResponse.json({ error: "courseId is required." }, { status: 400 });
    }
    const { courseId: _cid, classId: _lid, ...input } = body;
    const concept = await conceptStore.create(input, session.user.email, courseId);
    return NextResponse.json(concept, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
