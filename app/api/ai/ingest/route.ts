import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userSettings } from "@/lib/userSettings";
import { ingestRawContent } from "@/lib/ingestionService";
import { ingestRawContentGemini } from "@/lib/ingestionServiceGemini";
import type { StudentLevel } from "@/lib/studentLevel";
import { isIngestModelId, getIngestModel, DEFAULT_INGEST_MODEL, type IngestProvider } from "@/lib/ingestModels";
import { loadCourseSkeleton } from "@/lib/courseSkeleton";
import { applySlideAnchors } from "@/lib/slideAnchors";
import type { HybridIngestResponse } from "@/types/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VALID_STUDENT_LEVELS: StudentLevel[] = ["beginner", "intermediate", "advanced"];

export async function POST(req: Request) {
  let provider: IngestProvider = "anthropic";
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const settings = await userSettings.get(session.user.email);

    const body = await req.json();
    const model = isIngestModelId(body.model) ? body.model : DEFAULT_INGEST_MODEL;
    provider = getIngestModel(model).provider;

    const apiKey = provider === "gemini" ? settings.geminiKey : settings.anthropicKey;
    if (!apiKey) {
      const providerName = provider === "gemini" ? "Gemini" : "Anthropic";
      return NextResponse.json({ error: `No ${providerName} API key configured. Add your key in Settings.` }, { status: 402 });
    }

    // Hybrid payload: `courseConfig` (the skeleton) + `rawNotes` (the content). `rawText` is still
    // accepted so an older open tab doesn't break mid-session.
    const rawText = typeof body.rawNotes === "string" ? body.rawNotes : typeof body.rawText === "string" ? body.rawText : "";
    const courseId = typeof body.courseConfig?.courseId === "string" ? body.courseConfig.courseId
      : typeof body.courseId === "string" ? body.courseId : "";
    if (!courseId) return NextResponse.json({ error: "Select a course first — its sections are the deck's skeleton." }, { status: 400 });
    // The course is re-read here rather than trusting the anchors the browser sent: the server's
    // copy is the one that gets enforced, and this keeps the usual owner/collaborator scoping.
    const skeleton = await loadCourseSkeleton(courseId, session.user.email, settings);
    if (!skeleton) return NextResponse.json({ error: "Course not found or you don't have access to it." }, { status: 403 });

    const targetAudience = typeof body.targetAudience === "string" ? body.targetAudience : undefined;
    const slideCount = typeof body.slideCount === "number" ? Math.min(30, Math.max(1, body.slideCount)) : undefined;
    const studentLevel = VALID_STUDENT_LEVELS.includes(body.studentLevel) ? (body.studentLevel as StudentLevel) : undefined;
    const lessonTitle = typeof body.lessonTitle === "string" && body.lessonTitle.trim() ? body.lessonTitle.trim() : undefined;
    const lessonSubtitle = typeof body.lessonSubtitle === "string" && body.lessonSubtitle.trim() ? body.lessonSubtitle.trim() : undefined;
    const topics = typeof body.topics === "string" && body.topics.trim() ? body.topics.trim() : undefined;
    const sources = typeof body.sources === "string" && body.sources.trim() ? body.sources.trim() : undefined;

    const opts = {
      targetAudience, slideCount, anchors: skeleton.anchors, studentLevel, lessonTitle, lessonSubtitle, topics, sources, model,
    };
    const generated = provider === "gemini"
      ? await ingestRawContentGemini(apiKey, rawText, opts)
      : await ingestRawContent(apiKey, rawText, opts);
    // Models follow the anchor rules most of the time, not always — lock the skeleton in code.
    const { ast, report } = applySlideAnchors({ ...generated, themeId: skeleton.themeId }, skeleton.anchors);
    const response: HybridIngestResponse = { ast, anchors: skeleton.anchors, anchorReport: report };
    return NextResponse.json(response);
  } catch (err: any) {
    // Surface provider billing/auth errors clearly
    if (provider === "gemini") {
      if (err.status === 401) return NextResponse.json({ error: "Invalid Gemini API key." }, { status: 402 });
      if (err.status === 429 || err.status === 403) {
        return NextResponse.json({ error: "Gemini quota or billing exhausted. Check your usage at aistudio.google.com." }, { status: 402 });
      }
    } else {
      if (err.status === 401) return NextResponse.json({ error: "Invalid Anthropic API key." }, { status: 402 });
      if (err.status === 402) return NextResponse.json({ error: "Anthropic credits exhausted. Top up your account at console.anthropic.com." }, { status: 402 });
    }
    const msg = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
