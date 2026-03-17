import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { projectStore } from "@/lib/projectStore";
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

  if ((session as any).error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Your Google session has expired. Please sign out and sign in again." }, { status: 401 });
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
  let templateId: string | undefined;
  try {
    const body = await req.json();
    if (Array.isArray(body.files) && body.files.length > 0) files = body.files;
    if (body.destination === "download") destination = "download";
    if (typeof body.templateId === "string" && body.templateId) templateId = body.templateId;
  } catch {
    // empty body — use defaults
  }

  const inProgressStatus = lesson.status === "done" ? "regenerating" : "generating";
  await store.update(id, { status: inProgressStatus });

  try {
    if (destination === "drive") {
      const { folderUrl, deckId, formId } = await generateBundleSelective(lesson, files, accessToken, templateId);

      // Save generated files to the projects collection so they appear in dashboard tabs
      await Promise.all([
        deckId ? projectStore.create({ type: "deck", title: lesson.title, subtitle: lesson.subtitle, url: `https://docs.google.com/presentation/d/${deckId}/edit` }, session.user!.email!) : null,
        formId ? projectStore.create({ type: "form", title: lesson.title, subtitle: lesson.subtitle, isQuiz: true, url: `https://docs.google.com/forms/d/${formId}/edit` }, session.user!.email!) : null,
      ]);

      const updated = await store.update(id, { status: "done", folderUrl });
      return NextResponse.json(updated);
    } else {
      const downloadFiles = files.filter(f => f !== "quiz") as ("slides" | "doc")[];
      const downloads = await generateBundleAsDownload(lesson, downloadFiles, accessToken, templateId);
      await store.update(id, { status: "done" });
      return NextResponse.json({ downloads });
    }
  } catch (err: any) {
    await store.update(id, { status: "error", errorMessage: err.message });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
