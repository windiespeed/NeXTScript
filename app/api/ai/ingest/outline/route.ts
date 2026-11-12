import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiErrors";
import { auth } from "@/lib/auth";
import { userSettings } from "@/lib/userSettings";
import { outlineRawContent } from "@/lib/ingestionService";
import { outlineRawContentGemini } from "@/lib/ingestionServiceGemini";
import { anchorOutline } from "@/lib/ingestionPrompt";
import { resolveAiModel, getAiModel, type AiProvider, type ClaudeModelId } from "@/lib/aiModels";
import { courseAiInputs } from "@/lib/courseAiInputs";
import { loadCourseSkeleton } from "@/lib/courseSkeleton";
import { resolveProgramContext } from "@/lib/programContext";
import { hybridIngestSchema, parseBody, readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/ai/ingest/outline — the optional planning step of Notes to Slides: the same inputs as
 * /api/ai/ingest, but returns one line per slide (headline, section, layout, what it covers) for
 * the instructor to review and edit before the full deck is written from it.
 */
export async function POST(req: Request) {
  let provider: AiProvider = "anthropic";
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const settings = await userSettings.get(session.user.email);
    const parsed = parseBody(hybridIngestSchema, await readJson(req));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const body = parsed.data;

    const model = resolveAiModel(settings.preferredAiModel, { anthropic: !!settings.anthropicKey, gemini: !!settings.geminiKey });
    if (!model) {
      return NextResponse.json({ error: "No AI API key configured. Add a Claude or Gemini key in Profile." }, { status: 402 });
    }
    provider = getAiModel(model).provider;
    const apiKey = (provider === "gemini" ? settings.geminiKey : settings.anthropicKey)!;

    const skeleton = await loadCourseSkeleton(body.courseConfig.courseId, session.user.email, settings);
    if (!skeleton) return NextResponse.json({ error: "Course not found or you don't have access to it." }, { status: 403 });

    const { targetAudience, slideCount, lessonTitle, lessonSubtitle, topics } = body;
    // Student Level and Sources come from Course Settings only.
    const { studentLevel, sources } = courseAiInputs(skeleton.course);
    const opts = {
      targetAudience, slideCount, anchors: skeleton.anchors, studentLevel, lessonTitle, lessonSubtitle, topics, sources,
      program: resolveProgramContext(skeleton.course, settings),
    };
    const outline = provider === "gemini"
      ? await outlineRawContentGemini(apiKey, body.rawNotes, { ...opts, model })
      : await outlineRawContent(apiKey, body.rawNotes, { ...opts, model: model as ClaudeModelId });
    return NextResponse.json({ outline: anchorOutline(outline, skeleton.anchors) });
  } catch (err: any) {
    if (provider === "gemini") {
      if (err.status === 401) return NextResponse.json({ error: "Invalid Gemini API key." }, { status: 402 });
      if (err.status === 429 || err.status === 403) {
        return NextResponse.json({ error: "Gemini quota or billing exhausted. Check your usage at aistudio.google.com." }, { status: 402 });
      }
    } else {
      if (err.status === 401) return NextResponse.json({ error: "Invalid Anthropic API key." }, { status: 402 });
      if (err.status === 402) return NextResponse.json({ error: "Anthropic credits exhausted. Top up your account at console.anthropic.com." }, { status: 402 });
      if (err.status === 429) return NextResponse.json({ error: "Anthropic rate limit reached. Try again in a minute." }, { status: 429 });
    }
    if (err instanceof Error && !("status" in err) && !("code" in err)) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return serverError(err, "notes to slides outline");
  }
}
