import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { LessonInput } from "@/types/lesson";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const lessons = await store.getAll();
    return NextResponse.json(lessons);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: LessonInput = await req.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    const lesson = await store.create(body);
    return NextResponse.json(lesson, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
