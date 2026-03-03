import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { generateBundle } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const accessToken = (session as any).accessToken as string | undefined;
  if (!accessToken) {
    return NextResponse.json({ error: "No Google access token. Please sign out and sign in again." }, { status: 401 });
  }

  const lesson = await store.getById(id);
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  // Mark as generating (or regenerating if a bundle already existed)
  const inProgressStatus = lesson.status === "done" ? "regenerating" : "generating";
  await store.update(id, { status: inProgressStatus });

  try {
    const { folderUrl } = await generateBundle(lesson, accessToken);
    const updated = await store.update(id, { status: "done", folderUrl });
    return NextResponse.json(updated);
  } catch (err: any) {
    await store.update(id, { status: "error", errorMessage: err.message });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
