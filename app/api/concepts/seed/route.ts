import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { conceptStore } from "@/lib/conceptStore";
import { classStore } from "@/lib/classStore";
import { DEFAULT_JS_CONCEPTS } from "@/types/concept";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { classId } = await req.json();
    if (!classId) return NextResponse.json({ error: "classId is required." }, { status: 400 });
    const cls = await classStore.getById(classId);
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    if (cls.teacherId !== session.user.email) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const existing = await conceptStore.getByClass(classId);
    if (existing.length > 0) {
      return NextResponse.json({ error: "This class already has concepts. Delete them first to re-seed." }, { status: 400 });
    }
    const concepts = await conceptStore.createMany(DEFAULT_JS_CONCEPTS, session.user.email, classId);
    return NextResponse.json(concepts, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
