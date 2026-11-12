import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { canAccessLesson } from "@/lib/access";
import { serverError } from "@/lib/apiErrors";
import { parsePatch } from "@/lib/validation";
import { loadCourseSkeleton } from "@/lib/courseSkeleton";
import { ensureCourseFolderId, ensureLessonFolderId } from "@/lib/lessonFolders";
import { autoDeckName, moveFileToFolder, uploadPptxToDrive } from "@/lib/google";
import { DEFAULT_THEME_ID, THEMES, getTheme } from "@/lib/themes";
import { DeckSchema } from "@/lib/deck/schema";
import { buildDeckPptx } from "@/lib/deck/render/pptx";
import { exportDeckToGoogleSlides, presentationIdFromUrl } from "@/lib/deck/render/googleSlides";
import type { Lesson } from "@/types/lesson";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Exports a deck in the new format (lib/deck/schema.ts).
 *
 * target:
 * - "pptx": returns the .pptx file for download. No Drive involved.
 * - "drive-pptx": uploads the .pptx to Drive as-is.
 * - "google-slides": a native Google Slides deck. With a course Slides template, it is drawn onto
 *   a copy of the template (keeping its branding); otherwise the .pptx is converted by Drive.
 *
 * Drive files are filed in the lesson's folder (or the course's) when a lessonId/courseId is given.
 */
const exportSchema = z.object({
  deck: DeckSchema,
  target: z.enum(["pptx", "drive-pptx", "google-slides"]),
  themeId: z.string().max(100).optional(),
  lessonId: z.string().max(200).optional(),
  courseId: z.string().max(200).optional(),
});

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function fileName(name: string) {
  return `${name.replace(/[^\w\- ]+/g, "").trim().slice(0, 80) || "deck"}.pptx`;
}

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
    const parsed = parsePatch(exportSchema, body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { deck, target } = parsed.data;

    let lesson: Lesson | undefined;
    if (parsed.data.lessonId) {
      const found = await store.getById(parsed.data.lessonId);
      if (found && (await canAccessLesson(found, email))) lesson = found;
    }
    const courseId = parsed.data.courseId ?? lesson?.courseId;
    const skeleton = courseId ? await loadCourseSkeleton(courseId, email) : null;
    const course = skeleton?.course;

    const themeId = THEMES.some(t => t.id === parsed.data.themeId) ? parsed.data.themeId! : skeleton?.themeId ?? DEFAULT_THEME_ID;
    const theme = getTheme(themeId);
    const name = lesson ? autoDeckName(lesson.title, lesson.subtitle) : deck.lessonTitle;

    if (target === "pptx") {
      const buffer = await buildDeckPptx(deck, theme);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": PPTX_MIME,
          "Content-Disposition": `attachment; filename="${fileName(name)}"`,
        },
      });
    }

    if ((session as { error?: string }).error === "RefreshAccessTokenError") {
      return NextResponse.json({ error: "Your Google session has expired. Please sign out and sign in again." }, { status: 401 });
    }
    const accessToken = (session as { accessToken?: string }).accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: "No Google access token. Please sign out and sign in again." }, { status: 401 });
    }

    let id: string;
    let url: string;
    let method: "template" | "converted" | "pptx";
    const templateId = presentationIdFromUrl(course?.settings?.defaultTemplateUrl);

    if (target === "google-slides" && templateId) {
      try {
        ({ id, url } = await exportDeckToGoogleSlides({ deck, theme, name, accessToken, templateId }));
      } catch (err) {
        const status = (err as { code?: number }).code;
        if (status === 403 || status === 404) {
          return NextResponse.json(
            { error: "Couldn't open this course's Slides template. Check that you can open it in Google Drive, or clear it in Course Settings." },
            { status: 400 },
          );
        }
        throw err;
      }
      method = "template";
    } else {
      const buffer = await buildDeckPptx(deck, theme);
      const convert = target === "google-slides";
      const uploaded = await uploadPptxToDrive(buffer, name, accessToken, { convertToSlides: convert });
      id = uploaded.id;
      url = uploaded.webViewLink;
      method = convert ? "converted" : "pptx";
    }

    // File it next to the lesson's other materials. Best-effort: the file exists either way.
    try {
      if (lesson) {
        const courseFolderId = course ? await ensureCourseFolderId(course, accessToken, email) : undefined;
        await moveFileToFolder(id, await ensureLessonFolderId(lesson, courseFolderId, accessToken), accessToken);
      } else if (course) {
        await moveFileToFolder(id, await ensureCourseFolderId(course, accessToken, email), accessToken);
      }
    } catch (err) {
      console.warn("[deck export] couldn't file deck in its folder:", err);
    }

    // Keep the lesson's copy of the deck in step with what was exported, and log the file.
    if (lesson) {
      const now = new Date().toISOString();
      await store.update(lesson.id, {
        status: "done",
        deck: {
          content: deck,
          themeId,
          status: lesson.deck?.status ?? "draft",
          updatedAt: now,
          renders: [...(lesson.deck?.renders ?? []), { target, method, url, themeId, createdAt: now }].slice(-50),
        },
      });
    }

    return NextResponse.json({ url, method, themeId });
  } catch (err) {
    return serverError(err, "deck export");
  }
}
