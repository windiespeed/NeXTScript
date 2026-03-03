import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { LessonInput } from "@/types/lesson";

export const dynamic = "force-dynamic";

export async function GET() {
  const lessons = await store.getAll();
  return NextResponse.json(lessons);
}

export async function POST(req: Request) {
  const body: LessonInput = await req.json();

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const lesson = await store.create(body);
  return NextResponse.json(lesson, { status: 201 });
}
