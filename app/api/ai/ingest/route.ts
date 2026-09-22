import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userSettings } from "@/lib/userSettings";
import { ingestRawContent } from "@/lib/ingestionService";
import { ingestRawContentGemini } from "@/lib/ingestionServiceGemini";
import type { StudentLevel } from "@/lib/studentLevel";
import { isIngestModelId, getIngestModel, DEFAULT_INGEST_MODEL, type IngestProvider } from "@/lib/ingestModels";

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

    const rawText = typeof body.rawText === "string" ? body.rawText : "";
    const targetAudience = typeof body.targetAudience === "string" ? body.targetAudience : undefined;
    const slideCount = typeof body.slideCount === "number" ? Math.min(30, Math.max(1, body.slideCount)) : undefined;
    const requiredTopics = Array.isArray(body.requiredTopics)
      ? body.requiredTopics.filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0)
      : undefined;
    const studentLevel = VALID_STUDENT_LEVELS.includes(body.studentLevel) ? (body.studentLevel as StudentLevel) : undefined;
    const lessonTitle = typeof body.lessonTitle === "string" && body.lessonTitle.trim() ? body.lessonTitle.trim() : undefined;
    const lessonSubtitle = typeof body.lessonSubtitle === "string" && body.lessonSubtitle.trim() ? body.lessonSubtitle.trim() : undefined;
    const topics = typeof body.topics === "string" && body.topics.trim() ? body.topics.trim() : undefined;
    const sources = typeof body.sources === "string" && body.sources.trim() ? body.sources.trim() : undefined;

    const opts = {
      targetAudience, slideCount, requiredTopics, studentLevel, lessonTitle, lessonSubtitle, topics, sources, model,
    };
    const ast = provider === "gemini"
      ? await ingestRawContentGemini(apiKey, rawText, opts)
      : await ingestRawContent(apiKey, rawText, opts);
    return NextResponse.json(ast);
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
