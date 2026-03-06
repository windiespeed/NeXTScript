import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildCustomForm } from "@/lib/google";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = (session as any).accessToken as string | undefined;
  if (!accessToken) return NextResponse.json({ error: "No Google access token. Please sign out and sign in again." }, { status: 401 });

  const { title, description, questions, isQuiz } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!Array.isArray(questions) || questions.filter((q: any) => q.text?.trim()).length === 0) {
    return NextResponse.json({ error: "At least one question is required" }, { status: 400 });
  }

  try {
    const formId = await buildCustomForm(title, description ?? "", questions, accessToken, !!isQuiz);
    const url = `https://docs.google.com/forms/d/${formId}/edit`;
    return NextResponse.json({ formId, url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create form" }, { status: 500 });
  }
}
