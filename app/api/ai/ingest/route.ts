import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userSettings } from "@/lib/userSettings";
import { ingestRawContent } from "@/lib/ingestionService";
import { ingestRawContentGemini } from "@/lib/ingestionServiceGemini";
import { resolveAiModel, getAiModel, type AiProvider, type ClaudeModelId } from "@/lib/aiModels";
import { loadCourseSkeleton } from "@/lib/courseSkeleton";
import { applySlideAnchors } from "@/lib/slideAnchors";
import { hybridIngestSchema, parseBody } from "@/lib/validation";
import type { HybridIngestResponse } from "@/types/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  let provider: AiProvider = "anthropic";
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const settings = await userSettings.get(session.user.email);

    const parsed = parseBody(hybridIngestSchema, await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const body = parsed.data;
    // No model picker: use the saved preference if its key is there, else the default model for
    // whichever key is saved (Claude first).
    const model = resolveAiModel(settings.preferredAiModel, { anthropic: !!settings.anthropicKey, gemini: !!settings.geminiKey });
    if (!model) {
      return NextResponse.json({ error: "No AI API key configured. Add a Claude or Gemini key in Profile." }, { status: 402 });
    }
    provider = getAiModel(model).provider;
    const apiKey = (provider === "gemini" ? settings.geminiKey : settings.anthropicKey)!;

    // Hybrid payload: `courseConfig` (the skeleton) + `rawNotes` (the content).
    const rawText = body.rawNotes;
    const courseId = body.courseConfig.courseId;
    // The course is re-read here rather than trusting the anchors the browser sent: the server's
    // copy is the one that gets enforced, and this keeps the usual owner/collaborator scoping.
    const skeleton = await loadCourseSkeleton(courseId, session.user.email, settings);
    if (!skeleton) return NextResponse.json({ error: "Course not found or you don't have access to it." }, { status: 403 });

    const { targetAudience, slideCount, studentLevel, lessonTitle, lessonSubtitle, topics, sources } = body;

    const opts = {
      targetAudience, slideCount, anchors: skeleton.anchors, studentLevel, lessonTitle, lessonSubtitle, topics, sources,
    };
    const generated = provider === "gemini"
      ? await ingestRawContentGemini(apiKey, rawText, { ...opts, model })
      : await ingestRawContent(apiKey, rawText, { ...opts, model: model as ClaudeModelId });
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
