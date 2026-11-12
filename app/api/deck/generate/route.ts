import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { canAccessLesson } from "@/lib/access";
import { serverError } from "@/lib/apiErrors";
import { parsePatch } from "@/lib/validation";
import { userSettings } from "@/lib/userSettings";
import { loadCourseSkeleton } from "@/lib/courseSkeleton";
import { resolveProgramContext } from "@/lib/programContext";
import { DeckGenerationError, generateDeck } from "@/lib/deck/generate";
import { resolveAiModel, type ClaudeModelId } from "@/lib/aiModels";
import type { Lesson } from "@/types/lesson";
import { DEFAULT_THEME_ID } from "@/lib/themes";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Generates a deck in the new format from notes, with the caller's own Anthropic key.
 * With a lessonId, the deck is saved on the lesson as a draft (replacing any earlier draft content
 * but keeping its export history).
 */
const generateSchema = z.object({
  notes: z.string().min(1).max(60_000),
  lessonTitle: z.string().max(200).optional(),
  audience: z.string().max(500).optional(),
  lessonId: z.string().max(200).optional(),
  courseId: z.string().max(200).optional(),
  themeId: z.string().max(100).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const email = session.user.email;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request: expected JSON." }, { status: 400 });
    }
    const parsed = parsePatch(generateSchema, body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.data;

    const settings = await userSettings.get(email);
    if (!settings.anthropicKey) {
      return NextResponse.json({ error: "No Anthropic API key configured. Add your key in Settings." }, { status: 402 });
    }

    let lesson: Lesson | undefined;
    if (input.lessonId) {
      const found = await store.getById(input.lessonId);
      if (found && (await canAccessLesson(found, email))) lesson = found;
    }
    const courseId = input.courseId ?? lesson?.courseId;
    const skeleton = courseId ? await loadCourseSkeleton(courseId, email, settings) : null;
    const context = [
      skeleton ? `Course: ${skeleton.course.title}` : null,
      lesson?.subtitle ? `Lesson subtitle: ${lesson.subtitle}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    let result;
    try {
      result = await generateDeck(settings.anthropicKey, {
        notes: input.notes,
        lessonTitle: input.lessonTitle ?? lesson?.title,
        audience: input.audience,
        program: resolveProgramContext(skeleton?.course, settings),
        // The lesson's own level, else the course default.
        studentLevel: lesson?.studentLevel || skeleton?.course.settings?.studentLevel || undefined,
        context: context || undefined,
        // Claude only (the deck prompt and limits are tuned for Claude): the saved preference if it's a Claude model, else the default.
        model: resolveAiModel(settings.preferredAiModel, { anthropic: true, gemini: false }, ["anthropic"]) as ClaudeModelId,
      });
    } catch (err) {
      if (err instanceof DeckGenerationError) return NextResponse.json({ error: err.message, reason: err.reason }, { status: 422 });
      if (err instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "Invalid Anthropic API key." }, { status: 402 });
      if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Anthropic rate limit reached. Try again in a minute." }, { status: 429 });
      throw err;
    }

    if (lesson) {
      await store.update(lesson.id, {
        deck: {
          content: result.deck,
          themeId: input.themeId ?? lesson.deck?.themeId ?? skeleton?.themeId ?? DEFAULT_THEME_ID,
          status: "draft",
          updatedAt: new Date().toISOString(),
          renders: lesson.deck?.renders ?? [],
        },
      });
    }

    return NextResponse.json({ deck: result.deck, model: result.model, attempts: result.attempts, usage: result.usage, savedToLesson: !!lesson });
  } catch (err) {
    return serverError(err, "deck generate");
  }
}
