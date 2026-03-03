import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { generateBundleSelective, generateBundleAsDownload } from "@/lib/google";

export const dynamic = "force-dynamic";

type FileChoice = "slides" | "doc" | "quiz";
type Destination = "drive" | "download";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // Parse body — fall back to "all files, drive" if body is absent (backwards compat)
  let files: FileChoice[] = ["slides", "doc", "quiz"];
  let destination: Destination = "drive";
  try {
    const body = await req.json();
    if (Array.isArray(body.files) && body.files.length > 0) files = body.files;
    if (body.destination === "download") destination = "download";
  } catch {
    // empty body — use defaults
  }

  const inProgressStatus = lesson.status === "done" ? "regenerating" : "generating";
  await store.update(id, { status: inProgressStatus });

  try {
    if (destination === "drive") {
      const { folderUrl } = await generateBundleSelective(lesson, files, accessToken);
      const updated = await store.update(id, { status: "done", folderUrl });
      return NextResponse.json(updated);
    } else {
      const downloadFiles = files.filter(f => f !== "quiz") as ("slides" | "doc")[];
      const downloads = await generateBundleAsDownload(lesson, downloadFiles, accessToken);
      await store.update(id, { status: "done" });
      return NextResponse.json({ downloads });
    }
  } catch (err: any) {
    await store.update(id, { status: "error", errorMessage: err.message });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
