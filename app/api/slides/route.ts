import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildStandaloneSlides } from "@/lib/google";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = (session as any).accessToken as string | undefined;
  if (!accessToken) return NextResponse.json({ error: "No Google access token. Please sign out and sign in again." }, { status: 401 });

  const { title, subtitle, slides, templateId } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!Array.isArray(slides) || slides.length === 0) return NextResponse.json({ error: "At least one slide is required" }, { status: 400 });

  try {
    const deckId = await buildStandaloneSlides(title, subtitle ?? "", slides, accessToken, templateId);
    const url = `https://docs.google.com/presentation/d/${deckId}/edit`;
    return NextResponse.json({ deckId, url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create slide deck" }, { status: 500 });
  }
}
