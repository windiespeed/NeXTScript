import { NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { serverError } from "@/lib/apiErrors";
import { courseStore } from "@/lib/courseStore";
import { canAccessCourse } from "@/lib/access";
import { presentationIdFromUrl } from "@/lib/deck/render/googleSlides";
import { learnTemplateStyle, themeFromLearned, type Backdrop, type LearnedStyle } from "@/lib/deck/render/templateStyle";
import { pptxBackdropCss } from "@/lib/deck/render/templateBackdropCss";
import type { ThemeConfig } from "@/types/theme";

export const dynamic = "force-dynamic";

/**
 * The look of a course's Google Slides template, learned from its slides, as a theme the preview
 * can draw with. `{ template: null }` when the course has no template; `theme: null` when the
 * template's look lives in its master (the export still uses it, the preview can't show it).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const course = await courseStore.getById(id);
    if (!course || !canAccessCourse(course, session.user.email)) return NextResponse.json({ error: "Course not found." }, { status: 404 });

    const url = course.settings?.defaultTemplateUrl?.trim();
    const presentationId = presentationIdFromUrl(url);
    if (!url) return NextResponse.json({ template: null });
    if (!presentationId) {
      return NextResponse.json({ template: { url, name: null, theme: null, error: "This course's template link isn't a Google Slides link, so export uses the built-in look. Fix it in Course Settings." } });
    }

    const accessToken = (session as { accessToken?: string }).accessToken;
    if (!accessToken) return NextResponse.json({ template: { url, name: null, theme: null, error: "No Google access. Sign out and in again." } });

    const client = new google.auth.OAuth2();
    client.setCredentials({ access_token: accessToken });
    const slides = google.slides({ version: "v1", auth: client });
    try {
      const pres = await slides.presentations.get({ presentationId });
      const learned = learnTemplateStyle(pres.data);
      const name = pres.data.title ?? "Course template";
      const theme = learned ? themeFromLearned(learned, name) : null;
      if (theme && learned) {
        const css = await backdropCss(client, presentationId, (pres.data.slides ?? []).map(s => s.objectId ?? ""), learned);
        if (css) theme.backdropCss = css;
      }
      return NextResponse.json({ template: { url, name, theme } });
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 403 || code === 404) {
        return NextResponse.json({ template: { url, name: null, theme: null, error: "Can't open this course's Slides template. Check that you can open it in Google Drive." } });
      }
      throw err;
    }
  } catch (err) {
    return serverError(err, "template style");
  }
}

/**
 * The template's background gradients as CSS, so the preview shows them. The Slides API doesn't
 * expose gradients, so this reads them from a .pptx export of the template. Best effort: without
 * it the preview falls back to flat colors.
 */
async function backdropCss(
  client: InstanceType<typeof google.auth.OAuth2>,
  presentationId: string,
  slideIds: string[],
  learned: LearnedStyle,
): Promise<ThemeConfig["backdropCss"] | undefined> {
  const index = (b?: Backdrop) => (b ? slideIds.indexOf(b.slideId) : -1);
  const pictures = (b?: Backdrop) => (b?.art ?? []).filter(a => a.image);
  const wanted = { content: learned.contentBackdrop, dark: learned.coverBackdrop, title: learned.titleBackdrop };
  const keys = (Object.keys(wanted) as (keyof typeof wanted)[]).filter(k => index(wanted[k]) >= 0);
  if (!keys.length) return undefined;
  try {
    const drive = google.drive({ version: "v3", auth: client });
    const res = await drive.files.export(
      { fileId: presentationId, mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
      { responseType: "arraybuffer" },
    );
    const found = await pptxBackdropCss(res.data as ArrayBuffer, keys.map(k => ({ index: index(wanted[k]), art: pictures(wanted[k]) })));
    const css: NonNullable<ThemeConfig["backdropCss"]> = {};
    keys.forEach((k, i) => {
      if (found[i]) css[k] = found[i];
    });
    return Object.keys(css).length ? css : undefined;
  } catch {
    return undefined;
  }
}
