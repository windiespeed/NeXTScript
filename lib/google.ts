/**
 * Google API helpers — mirrors the bundle generation logic from the Apps Script.
 *
 * Requires a user OAuth access token (stored on the session after sign-in).
 * A Slides template URL can be optionally provided in the Generate modal;
 * if omitted a fresh blank presentation is created instead.
 */

import { google } from "googleapis";
import type { slides_v1 } from "googleapis";
import type { Lesson } from "@/types/lesson";
import type { FormQuestion } from "@/types/form";
import { DEFAULT_SECTIONS, type SectionDef } from "@/types/section";
import { getSectionContent } from "@/lib/sections";
import { getTheme, DEFAULT_THEME_ID } from "@/lib/themes";
import type { SavedProject } from "@/types/project";
import type {
  PresentationAST,
  SlideNode,
  StandardTextSlide,
  SplitColumnSlide,
  CodeExplainerSlide,
  CalloutCardSlide,
  StepGridSlide,
} from "@/types/slideAst";

function getAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

// ─── Drive ─────────────────────────────────────────────────────────────────

export async function createFolder(name: string, accessToken: string, parentFolderId?: string) {
  const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
    },
    fields: "id, webViewLink",
  });
  return res.data;
}

export async function createCourseFolder(name: string, accessToken: string): Promise<{ id: string; webViewLink: string }> {
  const data = await createFolder(name, accessToken);
  return { id: data.id!, webViewLink: data.webViewLink! };
}

const BLANK_MIME: Record<"doc" | "sheet" | "slides", string> = {
  doc:    "application/vnd.google-apps.document",
  sheet:  "application/vnd.google-apps.spreadsheet",
  slides: "application/vnd.google-apps.presentation",
};

export async function createBlankFile(
  name: string,
  docType: "doc" | "sheet" | "slides",
  accessToken: string,
  parentFolderId?: string
): Promise<{ id: string; url: string }> {
  const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: BLANK_MIME[docType],
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
    },
    fields: "id, webViewLink",
  });
  return { id: res.data.id!, url: res.data.webViewLink! };
}

/** Grant a Google account edit (or view) access to a Drive file/folder. Used for course collaborator sharing. */
export async function shareDriveFile(fileId: string, email: string, accessToken: string, role: "writer" | "reader" = "writer") {
  const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  await drive.permissions.create({
    fileId,
    sendNotificationEmail: false,
    requestBody: { type: "user", role, emailAddress: email },
  });
}

/** Revoke a previously-shared Google account's access to a Drive file/folder. */
export async function revokeDriveAccess(fileId: string, email: string, accessToken: string) {
  const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  const res = await drive.permissions.list({ fileId, fields: "permissions(id,emailAddress)" });
  const match = (res.data.permissions ?? []).find(p => p.emailAddress?.toLowerCase() === email.toLowerCase());
  if (match?.id) {
    await drive.permissions.delete({ fileId, permissionId: match.id });
  }
}

/** True if the given access token's account can currently see/access the Drive file. */
export async function hasDriveAccess(fileId: string, accessToken: string): Promise<boolean> {
  try {
    const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
    await drive.files.get({ fileId, fields: "id" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Shares a course's Drive folder with every course member (owner + collaborators) except
 * whoever is currently acting — that person already owns/has access as the file's creator.
 * Whichever course member first triggers folder creation owns it in their own Drive, so
 * without this every other member would be unable to see or write into it. Best-effort:
 * failures for individual recipients are swallowed so one bad email doesn't block the rest.
 */
export async function shareCourseFolderWithMembers(
  folderId: string,
  course: { userId: string; collaborators?: string[] },
  actingEmail: string,
  accessToken: string,
  extraEmails: string[] = []
): Promise<void> {
  const acting = actingEmail.toLowerCase();
  const seen = new Set<string>();
  const recipients = [course.userId, ...(course.collaborators ?? []), ...extraEmails].filter((email) => {
    const e = email.toLowerCase();
    if (e === acting || seen.has(e)) return false;
    seen.add(e);
    return true;
  });
  await Promise.all(recipients.map((email) => shareDriveFile(folderId, email, accessToken).catch(() => {})));
}

/** Adds one or more folders as additional parents of a file, without removing existing parents. */
export async function addFileToFolders(fileId: string, folderIds: string[], accessToken: string) {
  if (folderIds.length === 0) return;
  const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  await drive.files.update({
    fileId,
    addParents: folderIds.join(","),
    fields: "id, parents",
  });
}

export async function moveFileToFolder(fileId: string, folderId: string, accessToken: string) {
  const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  const file = await drive.files.get({ fileId, fields: "parents" });
  const prevParents = (file.data.parents || []).join(",");
  await drive.files.update({
    fileId,
    addParents: folderId,
    removeParents: prevParents,
    fields: "id, parents",
  });
}

// ─── Slides ─────────────────────────────────────────────────────────────────

/**
 * Generate a short unique object ID that satisfies the Slides API constraints:
 * - 5–50 characters, must start with a letter or underscore.
 * Uses a module-level counter so IDs within one request are always distinct.
 */
let _idSeq = 0;
function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(++_idSeq).toString(36)}`;
}

/** Replace all text in a shape. Only deletes first if the shape already has content. */
function replaceText(objectId: string, text: string, hasExistingContent: boolean): any[] {
  const reqs: any[] = [];
  if (hasExistingContent) {
    reqs.push({ deleteText: { objectId, textRange: { type: "ALL" } } });
  }
  reqs.push({ insertText: { objectId, insertionIndex: 0, text } });
  return reqs;
}

/**
 * Parse text for backtick-marked code segments.
 * Wrap any code example in backticks in your lesson content — e.g. `code here` —
 * and it will be rendered in blue in the generated slides.
 * Returns the plain text (backticks removed) and the index ranges to color blue.
 */
function parseCodeSegments(text: string): {
  plain: string;
  codeRanges: { startIndex: number; endIndex: number }[];
} {
  let plain = "";
  const codeRanges: { startIndex: number; endIndex: number }[] = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] === "`") {
      const closeIdx = text.indexOf("`", i + 1);
      if (closeIdx !== -1) {
        const start = plain.length;
        plain += text.substring(i + 1, closeIdx);
        if (plain.length > start) {
          codeRanges.push({ startIndex: start, endIndex: plain.length });
        }
        i = closeIdx + 1;
      } else {
        plain += text[i++];
      }
    } else {
      plain += text[i++];
    }
  }

  return { plain, codeRanges };
}

/** Blue used for code examples (matches the doc output requirement). */
const CODE_BLUE = { red: 0.067, green: 0.435, blue: 0.855 };
const TEXT_BLACK = { red: 0, green: 0, blue: 0 };

/** Strip leading bullet characters from every line. */
function stripBullets(text: string): string {
  return text.replace(/^[•\-\*]\s*/gm, "").trim();
}

/**
 * Build one slide's worth of API requests.
 * Uses TITLE_AND_BODY layout so the template's placeholder styling is preserved.
 * Bullet formatting is suppressed via deleteParagraphBullets after text insertion
 * (the AI is instructed not to produce bullet characters, but the BODY placeholder
 * can apply list style by default — this removes it).
 * Body text wrapped in backticks is rendered in blue (code examples).
 * All other body text is rendered in black.
 */
function slideRequests(title: string, body: string | undefined): any[] {
  const sId = uid("s");
  const tId = uid("t");
  const bId = uid("b");
  const { plain: bodyPlain, codeRanges } = parseCodeSegments(stripBullets(body ?? ""));

  const requests: any[] = [
    {
      createSlide: {
        objectId: sId,
        slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: "TITLE" }, objectId: tId },
          { layoutPlaceholder: { type: "BODY" }, objectId: bId },
        ],
      },
    },
    { insertText: { objectId: tId, insertionIndex: 0, text: title } },
  ];

  if (bodyPlain.length > 0) {
    requests.push(
      { insertText: { objectId: bId, insertionIndex: 0, text: bodyPlain } },
      // Remove bullet/list formatting the layout may apply automatically
      { deleteParagraphBullets: { objectId: bId, textRange: { type: "ALL" } } },
      // Default all body text to black
      {
        updateTextStyle: {
          objectId: bId,
          textRange: { type: "ALL" },
          style: { foregroundColor: { opaqueColor: { rgbColor: TEXT_BLACK } } },
          fields: "foregroundColor",
        },
      },
    );

    // Color each backtick-marked segment blue
    for (const { startIndex, endIndex } of codeRanges) {
      requests.push({
        updateTextStyle: {
          objectId: bId,
          textRange: { type: "FIXED_RANGE", startIndex, endIndex },
          style: { foregroundColor: { opaqueColor: { rgbColor: CODE_BLUE } } },
          fields: "foregroundColor",
        },
      });
    }
  }

  return requests;
}

/** Resolve rubric field, falling back to legacy taChecklist for old Firestore documents. */
function getRubric(lesson: Lesson): string {
  return lesson.rubric ?? (lesson as any).taChecklist ?? "";
}

/** getSectionContent() plus the rubric/taChecklist legacy fallback getRubric() already handles. */
function sectionSlideContent(lesson: Lesson, sectionId: string): string {
  return sectionId === "rubric" ? getRubric(lesson) : getSectionContent(lesson, sectionId);
}

export async function buildSlideDeck(lesson: Lesson, accessToken: string, templateId?: string, sections: SectionDef[] = DEFAULT_SECTIONS): Promise<string> {
  _idSeq = 0; // reset counter for each deck build
  const drive  = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  const slides = google.slides({ version: "v1", auth: getAuthClient(accessToken) });

  // 1. Copy template if provided, otherwise create a fresh blank presentation
  let deckId: string;
  if (templateId) {
    const copy = await drive.files.copy({
      fileId: templateId,
      requestBody: { name: `Deck: ${lesson.title} — ${lesson.subtitle}` },
      fields: "id",
    });
    deckId = copy.data.id!;
  } else {
    const created = await slides.presentations.create({
      requestBody: { title: `Deck: ${lesson.title} — ${lesson.subtitle}` },
    });
    deckId = created.data.presentationId!;
  }

  // 2. Fetch the presentation to read existing title-slide shape IDs
  const pres = await slides.presentations.get({ presentationId: deckId });
  const titleSlide = (pres.data.slides || [])[0];

  // ── Title slide replacements ────────────────────────────────────────────
  const titleRequests: any[] = [];

  if (titleSlide) {
    for (const el of titleSlide.pageElements || []) {
      const placeholderType = el.shape?.placeholder?.type as string | undefined;
      const text = el.shape?.text?.textElements
        ?.map((t: any) => t.textRun?.content || "")
        .join("")
        .toLowerCase() ?? "";

      const hasContent = text.length > 0;
      if (placeholderType === "CENTERED_TITLE" || placeholderType === "TITLE") {
        titleRequests.push(...replaceText(el.objectId!, lesson.title, hasContent));
      } else if (placeholderType === "SUBTITLE") {
        titleRequests.push(...replaceText(el.objectId!, lesson.subtitle, hasContent));
      } else if (text.includes("goal:")) {
        titleRequests.push(...replaceText(el.objectId!, `Goal: ${getSectionContent(lesson, "lessonOverview").replace(/\n+/g, " ")}`, hasContent));
      } else if (text.includes("reminder:")) {
        titleRequests.push(...replaceText(el.objectId!, `Reminder: ${getSectionContent(lesson, "submissionChecklist").replace(/\n+/g, " · ")}`, hasContent));
      }
    }
  }

  // ── Section slides — matches Google Doc template order ──────────────────
  const beforeSlideSections = sections.filter(s => (s.position ?? "after-slides") === "before-slides");
  const afterSlideSections = sections.filter(s => (s.position ?? "after-slides") === "after-slides");

  const contentRequests: any[] = [];
  for (const s of beforeSlideSections) {
    const content = sectionSlideContent(lesson, s.id);
    if (s.skipIfEmpty && !content) continue;
    contentRequests.push(...slideRequests(s.label.toUpperCase(), content));
  }

  // ── Custom slide content blocks (--- = slide break, first line = title) ─
  const slideSep = /\n---\n/;
  const slideBlocks = slideSep.test(lesson.slideContent)
    ? lesson.slideContent.split(slideSep)
    : lesson.slideContent.split(/\n\s*\n/);
  for (const block of slideBlocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    contentRequests.push(...slideRequests(lines[0].trim(), lines.slice(1).join("\n").trim()));
  }

  // ── Post-content section slides ─────────────────────────────────────────
  for (const s of afterSlideSections) {
    const content = sectionSlideContent(lesson, s.id);
    if (s.skipIfEmpty && !content) continue;
    contentRequests.push(...slideRequests(s.label.toUpperCase(), content));
  }

  // ── Success slide ───────────────────────────────────────────────────────
  const successSlideId = uid("ss");
  const successTextId  = uid("st");
  contentRequests.push(
    {
      createSlide: {
        objectId: successSlideId,
        slideLayoutReference: resolveBlankLayoutRef(pres.data.layouts, !!templateId),
      },
    },
    {
      createShape: {
        objectId: successTextId,
        shapeType: "TEXT_BOX",
        elementProperties: {
          pageObjectId: successSlideId,
          size: { width: { magnitude: 720, unit: "PT" }, height: { magnitude: 100, unit: "PT" } },
          transform: { scaleX: 1, scaleY: 1, translateX: 0, translateY: 150, unit: "PT" },
        },
      },
    },
    { insertText: { objectId: successTextId, insertionIndex: 0, text: "LESSON COMPLETE!" } },
    {
      updateTextStyle: {
        objectId: successTextId,
        textRange: { type: "ALL" },
        style: { bold: true, fontSize: { magnitude: 40, unit: "PT" } },
        fields: "bold,fontSize",
      },
    },
  );

  // ── Batch updates ────────────────────────────────────────────────────────
  if (titleRequests.length > 0) {
    await slides.presentations.batchUpdate({ presentationId: deckId, requestBody: { requests: titleRequests } });
  }
  await slides.presentations.batchUpdate({ presentationId: deckId, requestBody: { requests: contentRequests } });

  return deckId;
}

// ─── AST-to-Slides Deck (Gamma-style ingestion pipeline) ────────────────────
//
// Renders a `PresentationAST` (see types/slideAst.ts) as a real Google Slides
// deck. Every slide is a blank slide with manually-positioned shapes rather
// than a named `predefinedLayout` (other than the initial title-slide reuse
// below) — a copied user template's master may not define exotic layouts like
// TITLE_AND_TWO_COLUMNS, so hand-positioned shapes are the only approach that
// behaves the same whether or not a template was supplied.
//
// Assumes the standard 720×405pt (10in × 5.625in, 16:9) Slides page size —
// the same assumption `buildSlideDeck`'s success-slide already makes above.

type RgbColor = { red: number; green: number; blue: number };
type SlideRequest = slides_v1.Schema$Request;

const AST_PAGE_WIDTH = 720;
const AST_PAGE_HEIGHT = 405;
const AST_MARGIN = 40;
const AST_CONTENT_WIDTH = AST_PAGE_WIDTH - AST_MARGIN * 2;

// Code panels always render dark regardless of theme — mirrors the browser preview's own
// convention (components/slides/CodeExplainerSlide.tsx hardcodes #0d1117 the same way).
const AST_CODE_PANEL_BG:  RgbColor = { red: 0.051, green: 0.067, blue: 0.090 }; // #0d1117
const AST_CODE_LABEL:     RgbColor = { red: 0.6,   green: 0.62,  blue: 0.66 };
const AST_WHITE:           RgbColor = { red: 1, green: 1, blue: 1 };

// The color roles that vary by theme — derived from a ThemeConfig (lib/themes.ts) so an exported
// deck actually matches what was previewed in-browser, instead of one fixed hardcoded palette.
type AstPalette = {
  pageBackground: RgbColor;
  accentCyan: RgbColor;
  accentOrange: RgbColor;
  accentPurple: RgbColor;
  textPrimary: RgbColor;
  textSecondary: RgbColor;
  cardBg: RgbColor;
};

function hexToRgbColor(hex: string): RgbColor {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return { red: r || 0, green: g || 0, blue: b || 0 };
}

/** Blends a color toward white — approximates the ~10% opacity tint technique
 * components/slides/CalloutSlide.tsx uses in the browser (`${accent}1a`), since Slides shape
 * fills don't support alpha the same way. */
function tint(rgb: RgbColor, amount: number): RgbColor {
  return {
    red: rgb.red + (1 - rgb.red) * amount,
    green: rgb.green + (1 - rgb.green) * amount,
    blue: rgb.blue + (1 - rgb.blue) * amount,
  };
}

function paletteForTheme(themeId: string): AstPalette {
  const theme = getTheme(themeId);
  return {
    pageBackground: hexToRgbColor(theme.background.page),
    accentCyan: hexToRgbColor(theme.accent.primary),
    accentOrange: hexToRgbColor(theme.accent.secondary),
    accentPurple: hexToRgbColor(theme.accent.tertiary),
    textPrimary: hexToRgbColor(theme.text.primary),
    textSecondary: hexToRgbColor(theme.text.secondary),
    cardBg: hexToRgbColor(theme.background.cardAlt),
  };
}

// The callout panel itself (astCalloutSlideRequests) is always filled with a light pastel tint
// of the variant's accent color (tint() blends toward white, regardless of theme) — Slides shape
// fills can't reproduce the browser's alpha-composited accent-over-themed-card look, so the panel
// is intentionally light-on-any-theme instead. Text drawn on it must therefore stay dark for
// contrast; the theme's own text colors (near-white on dark themes) would be illegible here.
const CALLOUT_PANEL_TEXT_PRIMARY: RgbColor = hexToRgbColor("#1f2937");
const CALLOUT_PANEL_TEXT_SECONDARY: RgbColor = hexToRgbColor("#4b5563");

// Variant→accent-slot mapping mirrors components/slides/CalloutSlide.tsx's own convention exactly
// (tip→primary, warning→secondary, instructor-note→tertiary). Backgrounds are a light tint of
// that same accent rather than a fixed pastel constant, so callouts stay legible on dark themes.
function astCalloutVariants(palette: AstPalette): Record<CalloutCardSlide["variant"], { label: string; accent: RgbColor; bg: RgbColor }> {
  return {
    warning:            { label: "HEADS UP",        accent: palette.accentOrange, bg: tint(palette.accentOrange, 0.9) },
    tip:                { label: "PRO TIP",          accent: palette.accentCyan,   bg: tint(palette.accentCyan, 0.9) },
    "instructor-note":  { label: "INSTRUCTOR NOTE",  accent: palette.accentPurple, bg: tint(palette.accentPurple, 0.9) },
  };
}

/** Resolves a layout reference guaranteed to actually exist on this presentation, instead of
 * assuming `predefinedLayout: "BLANK"` is always defined — a custom Slides Template's master
 * may not tag any layout with that predefined type at all, which Slides rejects outright
 * ("The predefined layout (BLANK) is not present in the current master"). A fresh,
 * template-less presentation always uses Google's default theme, which does define it, so
 * this only needs to search when a template was actually copied. Prefers the layout with the
 * fewest page elements (ideally zero) — guaranteed present since it's read from the
 * presentation's own data, and least likely to leak inherited placeholder shapes/text. */
function resolveBlankLayoutRef(
  layouts: slides_v1.Schema$Page[] | undefined,
  usedTemplate: boolean
): slides_v1.Schema$LayoutReference {
  if (!usedTemplate) return { predefinedLayout: "BLANK" };
  const candidates = (layouts ?? []).filter(l => !!l.objectId);
  if (candidates.length === 0) return { predefinedLayout: "BLANK" }; // nothing to pick from — best effort
  const best = [...candidates].sort((a, b) => (a.pageElements?.length ?? 0) - (b.pageElements?.length ?? 0))[0];
  return { layoutId: best.objectId };
}

// Uses whichever layout reference resolveBlankLayoutRef() found, rather than guessing a
// "blank-looking" layout by name from the template's master — a guessed layout can carry its
// own placeholder shapes ("Click to add title"/"Click to add text") that then sit behind the
// AST builder's own text boxes.
//
// Also paints the slide's own page background with the selected theme's page color — the
// layout/master's background (white, or whatever a course Slides Template ships) is otherwise
// left untouched, which is invisible on light themes but produces light text on a white page
// for dark themes (Vortex/Twilight) since AstPalette's text colors assume a dark backdrop.
function astCreateBlankSlideRequest(slideId: string, layoutRef: slides_v1.Schema$LayoutReference, pageBackground: RgbColor): SlideRequest[] {
  return [
    {
      createSlide: {
        objectId: slideId,
        slideLayoutReference: layoutRef,
      },
    },
    {
      updatePageProperties: {
        objectId: slideId,
        pageProperties: { pageBackgroundFill: { solidFill: { color: { rgbColor: pageBackground } } } },
        fields: "pageBackgroundFill.solidFill.color",
      },
    },
  ];
}

function astShapeRequest(objectId: string, slideId: string, shapeType: string, x: number, y: number, w: number, h: number): SlideRequest {
  return {
    createShape: {
      objectId,
      shapeType,
      elementProperties: {
        pageObjectId: slideId,
        size: { width: { magnitude: w, unit: "PT" }, height: { magnitude: h, unit: "PT" } },
        transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: "PT" },
      },
    },
  };
}

function astInsertText(objectId: string, text: string): SlideRequest {
  return { insertText: { objectId, insertionIndex: 0, text } };
}

function astTextStyle(objectId: string, style: slides_v1.Schema$TextStyle, fields: string, range: slides_v1.Schema$Range = { type: "ALL" }): SlideRequest {
  return { updateTextStyle: { objectId, textRange: range, style, fields } };
}

function astParagraphAlign(objectId: string, alignment: "START" | "CENTER" | "END", range: slides_v1.Schema$Range = { type: "ALL" }): SlideRequest {
  return { updateParagraphStyle: { objectId, textRange: range, style: { alignment }, fields: "alignment" } };
}

function astBullets(objectId: string, range: slides_v1.Schema$Range = { type: "ALL" }): SlideRequest {
  return { createParagraphBullets: { objectId, textRange: range, bulletPreset: "BULLET_DISC_CIRCLE_SQUARE" } };
}

function astShapeFill(objectId: string, rgbColor: RgbColor): SlideRequest {
  return {
    updateShapeProperties: {
      objectId,
      shapeProperties: { shapeBackgroundFill: { solidFill: { color: { rgbColor } } } },
      fields: "shapeBackgroundFill.solidFill.color",
    },
  };
}

/** Title (+ optional subtitle) header shared by every slide type. Returns the y-coordinate content should start at. */
function astTitleHeader(slideId: string, title: string, subtitle: string | undefined, palette: AstPalette): { requests: SlideRequest[]; contentStartY: number } {
  const requests: SlideRequest[] = [];
  const titleId = uid("t");
  requests.push(
    astShapeRequest(titleId, slideId, "TEXT_BOX", AST_MARGIN, 28, AST_CONTENT_WIDTH, 50),
    astInsertText(titleId, title),
    astTextStyle(titleId, { bold: true, fontSize: { magnitude: 22, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: palette.textPrimary } } }, "bold,fontSize,foregroundColor"),
  );

  let y = 80;
  if (subtitle) {
    const subId = uid("st");
    requests.push(
      astShapeRequest(subId, slideId, "TEXT_BOX", AST_MARGIN, y, AST_CONTENT_WIDTH, 24),
      astInsertText(subId, subtitle),
      astTextStyle(subId, { italic: true, fontSize: { magnitude: 13, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: palette.textSecondary } } }, "italic,fontSize,foregroundColor"),
    );
    y += 30;
  }

  return { requests, contentStartY: y + 6 };
}

function astStandardSlideRequests(slide: StandardTextSlide, palette: AstPalette, layoutRef: slides_v1.Schema$LayoutReference): SlideRequest[] {
  const slideId = uid("s");
  const requests: SlideRequest[] = [...astCreateBlankSlideRequest(slideId, layoutRef, palette.pageBackground)];
  const { requests: headerReqs, contentStartY } = astTitleHeader(slideId, slide.title, slide.subtitle, palette);
  requests.push(...headerReqs);

  const paragraphText = slide.paragraphs.map(p => p.trim()).filter(Boolean).join("\n\n");
  const bulletItems = (slide.bulletPoints ?? []).map(stripBullets).filter(Boolean);
  const bulletsText = bulletItems.join("\n");

  let fullText = paragraphText;
  let bulletStart = -1;
  if (bulletsText) {
    if (paragraphText) {
      bulletStart = paragraphText.length + 2; // length of the "\n\n" separator
      fullText = `${paragraphText}\n\n${bulletsText}`;
    } else {
      bulletStart = 0;
      fullText = bulletsText;
    }
  }

  if (fullText) {
    const bodyId = uid("b");
    const bodyH = AST_PAGE_HEIGHT - contentStartY - AST_MARGIN;
    requests.push(
      astShapeRequest(bodyId, slideId, "TEXT_BOX", AST_MARGIN, contentStartY, AST_CONTENT_WIDTH, bodyH),
      astInsertText(bodyId, fullText),
      astTextStyle(bodyId, { fontSize: { magnitude: 13, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: palette.textSecondary } } }, "fontSize,foregroundColor"),
    );
    if (bulletStart >= 0) {
      requests.push(astBullets(bodyId, { type: "FIXED_RANGE", startIndex: bulletStart, endIndex: fullText.length }));
    }
  }

  return requests;
}

function astSplitColumnSlideRequests(slide: SplitColumnSlide, palette: AstPalette, layoutRef: slides_v1.Schema$LayoutReference): SlideRequest[] {
  const slideId = uid("s");
  const requests: SlideRequest[] = [...astCreateBlankSlideRequest(slideId, layoutRef, palette.pageBackground)];
  const { requests: headerReqs, contentStartY } = astTitleHeader(slideId, slide.title, slide.subtitle, palette);
  requests.push(...headerReqs);

  const gap = 20;
  const colWidth = (AST_CONTENT_WIDTH - gap) / 2;
  const colHeight = AST_PAGE_HEIGHT - contentStartY - AST_MARGIN;

  function column(x: number, heading: string, content: string[], accent: RgbColor) {
    const items = content.map(stripBullets).filter(Boolean);
    const cardId = uid("c");
    requests.push(
      astShapeRequest(cardId, slideId, "ROUND_RECTANGLE", x, contentStartY, colWidth, colHeight),
      astShapeFill(cardId, palette.cardBg),
    );
    const headingLine = heading.toUpperCase();
    const text = items.length > 0 ? `${headingLine}\n${items.join("\n")}` : headingLine;
    requests.push(
      astInsertText(cardId, text),
      astTextStyle(cardId, { bold: true, fontSize: { magnitude: 11, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: accent } } }, "bold,fontSize,foregroundColor", { type: "FIXED_RANGE", startIndex: 0, endIndex: headingLine.length }),
    );
    if (items.length > 0) {
      requests.push(
        astTextStyle(cardId, { fontSize: { magnitude: 12, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: palette.textSecondary } } }, "fontSize,foregroundColor", { type: "FIXED_RANGE", startIndex: headingLine.length + 1, endIndex: text.length }),
        astBullets(cardId, { type: "FIXED_RANGE", startIndex: headingLine.length + 1, endIndex: text.length }),
      );
    }
  }

  column(AST_MARGIN, slide.leftColumn.heading, slide.leftColumn.content, palette.accentCyan);
  column(AST_MARGIN + colWidth + gap, slide.rightColumn.heading, slide.rightColumn.content, palette.accentOrange);

  return requests;
}

function astCodeExplainerSlideRequests(slide: CodeExplainerSlide, palette: AstPalette, layoutRef: slides_v1.Schema$LayoutReference): SlideRequest[] {
  const slideId = uid("s");
  const requests: SlideRequest[] = [...astCreateBlankSlideRequest(slideId, layoutRef, palette.pageBackground)];
  const { requests: headerReqs, contentStartY } = astTitleHeader(slideId, slide.title, slide.subtitle, palette);
  requests.push(...headerReqs);

  const gap = 20;
  const colWidth = (AST_CONTENT_WIDTH - gap) / 2;
  const colHeight = AST_PAGE_HEIGHT - contentStartY - AST_MARGIN;

  // Code panel — dark fill + monospace text, mirroring the React CodeExplainerSlide's code panel.
  const codeId = uid("code");
  const langLabel = slide.language.toUpperCase();
  const codeText = `${langLabel}\n${slide.codeSnippet}`;
  requests.push(
    astShapeRequest(codeId, slideId, "TEXT_BOX", AST_MARGIN, contentStartY, colWidth, colHeight),
    astShapeFill(codeId, AST_CODE_PANEL_BG),
    astInsertText(codeId, codeText),
    astTextStyle(codeId, { fontFamily: "Courier New", fontSize: { magnitude: 11, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: AST_WHITE } } }, "fontFamily,fontSize,foregroundColor"),
    astTextStyle(codeId, { bold: true, foregroundColor: { opaqueColor: { rgbColor: AST_CODE_LABEL } } }, "bold,foregroundColor", { type: "FIXED_RANGE", startIndex: 0, endIndex: langLabel.length }),
  );

  // Explanation column
  const explId = uid("expl");
  const explHeading = "EXPLANATION";
  const points = slide.explanationPoints.map(stripBullets).filter(Boolean);
  const explText = points.length > 0 ? `${explHeading}\n${points.join("\n")}` : explHeading;
  requests.push(
    astShapeRequest(explId, slideId, "TEXT_BOX", AST_MARGIN + colWidth + gap, contentStartY, colWidth, colHeight),
    astInsertText(explId, explText),
    astTextStyle(explId, { bold: true, fontSize: { magnitude: 11, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: palette.accentCyan } } }, "bold,fontSize,foregroundColor", { type: "FIXED_RANGE", startIndex: 0, endIndex: explHeading.length }),
  );
  if (points.length > 0) {
    requests.push(
      astTextStyle(explId, { fontSize: { magnitude: 12, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: palette.textSecondary } } }, "fontSize,foregroundColor", { type: "FIXED_RANGE", startIndex: explHeading.length + 1, endIndex: explText.length }),
      astBullets(explId, { type: "FIXED_RANGE", startIndex: explHeading.length + 1, endIndex: explText.length }),
    );
  }

  return requests;
}

function astCalloutSlideRequests(slide: CalloutCardSlide, palette: AstPalette, layoutRef: slides_v1.Schema$LayoutReference): SlideRequest[] {
  const slideId = uid("s");
  const requests: SlideRequest[] = [...astCreateBlankSlideRequest(slideId, layoutRef, palette.pageBackground)];
  const config = astCalloutVariants(palette)[slide.variant];

  const panelX = 80, panelY = 55, panelW = AST_PAGE_WIDTH - 160, panelH = AST_PAGE_HEIGHT - 110;
  const panelId = uid("panel");
  requests.push(
    astShapeRequest(panelId, slideId, "ROUND_RECTANGLE", panelX, panelY, panelW, panelH),
    astShapeFill(panelId, config.bg),
  );

  let y = panelY + 26;
  const labelId = uid("label");
  requests.push(
    astShapeRequest(labelId, slideId, "TEXT_BOX", panelX, y, panelW, 20),
    astInsertText(labelId, config.label),
    astTextStyle(labelId, { bold: true, fontSize: { magnitude: 11, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: config.accent } } }, "bold,fontSize,foregroundColor"),
    astParagraphAlign(labelId, "CENTER"),
  );
  y += 30;

  const titleId = uid("title");
  requests.push(
    astShapeRequest(titleId, slideId, "TEXT_BOX", panelX, y, panelW, 40),
    astInsertText(titleId, slide.title),
    astTextStyle(titleId, { bold: true, fontSize: { magnitude: 22, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: CALLOUT_PANEL_TEXT_PRIMARY } } }, "bold,fontSize,foregroundColor"),
    astParagraphAlign(titleId, "CENTER"),
  );
  y += 48;

  if (slide.subtitle) {
    const subId = uid("sub");
    requests.push(
      astShapeRequest(subId, slideId, "TEXT_BOX", panelX, y, panelW, 24),
      astInsertText(subId, slide.subtitle),
      astTextStyle(subId, { italic: true, fontSize: { magnitude: 13, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: CALLOUT_PANEL_TEXT_SECONDARY } } }, "italic,fontSize,foregroundColor"),
      astParagraphAlign(subId, "CENTER"),
    );
    y += 30;
  }

  const contentId = uid("content");
  const contentH = Math.max(panelY + panelH - y - 20, 40);
  requests.push(
    astShapeRequest(contentId, slideId, "TEXT_BOX", panelX + 30, y, panelW - 60, contentH),
    astInsertText(contentId, slide.content),
    astTextStyle(contentId, { fontSize: { magnitude: 14, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: CALLOUT_PANEL_TEXT_PRIMARY } } }, "fontSize,foregroundColor"),
    astParagraphAlign(contentId, "CENTER"),
  );

  return requests;
}

function astStepGridSlideRequests(slide: StepGridSlide, palette: AstPalette, layoutRef: slides_v1.Schema$LayoutReference): SlideRequest[] {
  const slideId = uid("s");
  const requests: SlideRequest[] = [...astCreateBlankSlideRequest(slideId, layoutRef, palette.pageBackground)];
  const { requests: headerReqs, contentStartY } = astTitleHeader(slideId, slide.title, slide.subtitle, palette);
  requests.push(...headerReqs);

  const steps = [...slide.steps].sort((a, b) => a.stepNumber - b.stepNumber);
  if (steps.length === 0) return requests;

  const cols = Math.min(3, steps.length);
  const rows = Math.ceil(steps.length / cols);
  const gap = 16;
  const cardW = (AST_CONTENT_WIDTH - gap * (cols - 1)) / cols;
  const availableH = AST_PAGE_HEIGHT - contentStartY - AST_MARGIN;
  const cardH = (availableH - gap * (rows - 1)) / rows;

  steps.forEach((step, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = AST_MARGIN + col * (cardW + gap);
    const y = contentStartY + row * (cardH + gap);

    const cardId = uid("card");
    const heading = `${step.stepNumber}. ${step.title}`;
    const text = `${heading}\n${step.description}`;
    requests.push(
      astShapeRequest(cardId, slideId, "ROUND_RECTANGLE", x, y, cardW, cardH),
      astShapeFill(cardId, palette.cardBg),
      astInsertText(cardId, text),
      astTextStyle(cardId, { bold: true, fontSize: { magnitude: 12, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: palette.textPrimary } } }, "bold,fontSize,foregroundColor", { type: "FIXED_RANGE", startIndex: 0, endIndex: heading.length }),
      astTextStyle(cardId, { fontSize: { magnitude: 11, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: palette.textSecondary } } }, "fontSize,foregroundColor", { type: "FIXED_RANGE", startIndex: heading.length + 1, endIndex: text.length }),
    );
  });

  return requests;
}

/** Routes a single AST node to its request-builder — mirrors the exhaustive switch in components/slides/SlideRenderer.tsx. */
function astSlideRequests(slide: SlideNode, palette: AstPalette, layoutRef: slides_v1.Schema$LayoutReference): SlideRequest[] {
  switch (slide.type) {
    case "standard": return astStandardSlideRequests(slide, palette, layoutRef);
    case "split-column": return astSplitColumnSlideRequests(slide, palette, layoutRef);
    case "code-explainer": return astCodeExplainerSlideRequests(slide, palette, layoutRef);
    case "callout": return astCalloutSlideRequests(slide, palette, layoutRef);
    case "step-grid": return astStepGridSlideRequests(slide, palette, layoutRef);
    default: {
      const _exhaustive: never = slide;
      return _exhaustive;
    }
  }
}

/**
 * Renders a `PresentationAST` as a real Google Slides presentation and returns the new file's ID.
 * Mirrors `buildSlideDeck`'s copy-template-or-create-blank + title-slide-reuse structure above.
 */
export async function buildSlideDeckFromAst(ast: PresentationAST, accessToken: string, templateId?: string, themeId: string = DEFAULT_THEME_ID): Promise<string> {
  _idSeq = 0; // reset counter for each deck build
  const palette = paletteForTheme(themeId);
  const drive  = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  const slides = google.slides({ version: "v1", auth: getAuthClient(accessToken) });

  // 1. Copy template if provided, otherwise create a fresh blank presentation
  let deckId: string;
  if (templateId) {
    const copy = await drive.files.copy({
      fileId: templateId,
      requestBody: { name: `Deck: ${ast.lessonTitle}` },
      fields: "id",
    });
    deckId = copy.data.id!;
  } else {
    const created = await slides.presentations.create({
      requestBody: { title: `Deck: ${ast.lessonTitle}` },
    });
    deckId = created.data.presentationId!;
  }

  // 2. Fetch the presentation to read existing slides
  const pres = await slides.presentations.get({ presentationId: deckId });
  const existingSlides = pres.data.slides || [];

  // 3. If a template was copied, reuse its first slide as the title slide (same placeholder
  // detection as buildSlideDeck) and drop any other pre-existing slides. A fresh blank
  // presentation's single default slide is dropped outright — the AST supplies its own opener.
  const titleRequests: SlideRequest[] = [];
  let slidesToDelete: string[];
  if (templateId && existingSlides.length > 0) {
    const titleSlide = existingSlides[0];
    for (const el of titleSlide.pageElements || []) {
      const placeholderType = el.shape?.placeholder?.type ?? undefined;
      const text = el.shape?.text?.textElements?.map((t) => t.textRun?.content || "").join("").toLowerCase() ?? "";
      const hasContent = text.length > 0;
      if (placeholderType === "CENTERED_TITLE" || placeholderType === "TITLE") {
        titleRequests.push(...replaceText(el.objectId!, ast.lessonTitle, hasContent));
      } else if (placeholderType === "SUBTITLE") {
        titleRequests.push(...replaceText(el.objectId!, ast.targetAudience, hasContent));
      }
    }
    slidesToDelete = existingSlides.slice(1).map(s => s.objectId).filter((id): id is string => !!id);
  } else {
    slidesToDelete = existingSlides.map(s => s.objectId).filter((id): id is string => !!id);
  }

  // 4. Build every content slide from the AST
  const layoutRef = resolveBlankLayoutRef(pres.data.layouts, !!templateId);
  const contentRequests: SlideRequest[] = [];
  for (const slide of ast.slides) {
    contentRequests.push(...astSlideRequests(slide, palette, layoutRef));
  }

  // ── Batch updates ────────────────────────────────────────────────────────
  if (titleRequests.length > 0) {
    await slides.presentations.batchUpdate({ presentationId: deckId, requestBody: { requests: titleRequests } });
  }
  // New slides are queued before the deleteObject requests so the presentation is never left
  // with zero slides at any point while this batch is applied (Slides API forbids that state).
  await slides.presentations.batchUpdate({
    presentationId: deckId,
    requestBody: { requests: [...contentRequests, ...slidesToDelete.map(objectId => ({ deleteObject: { objectId } }))] },
  });

  return deckId;
}

// ─── Docs (Assessment/Assignment Sheet) ──────────────────────────────────────

/** Splits a classic-pipeline slideContent string into {title, body} blocks — shared by the
 * classic Slide Deck builder's own slide loop and the Overview Doc's per-deck summaries. */
function parseSlideContentBlocks(raw: string): { title: string; body: string }[] {
  const sep = /\n---\n/;
  const blocks = sep.test(raw) ? raw.split(sep) : raw.split(/\n\n+/);
  return blocks.map(block => {
    const lines = block.trim().split("\n");
    return { title: lines[0] ?? "", body: lines.slice(1).join("\n").trim() };
  }).filter(s => s.title);
}

/** Flattens one AST slide node (any of the 5 layout types) into plain {title, body} text —
 * mirrors the exhaustive switch in astSlideRequests, but for text extraction instead of
 * Slides API requests. Used by the Overview Doc to summarize a Notes-to-Slides deck. */
function flattenAstSlide(slide: SlideNode): { title: string; body: string } {
  switch (slide.type) {
    case "standard": {
      const bullets = (slide.bulletPoints ?? []).map(b => `• ${b}`);
      return { title: slide.title, body: [...slide.paragraphs, ...bullets].filter(Boolean).join("\n") };
    }
    case "split-column": {
      const left = [slide.leftColumn.heading, ...slide.leftColumn.content.map(c => `• ${c}`)].join("\n");
      const right = [slide.rightColumn.heading, ...slide.rightColumn.content.map(c => `• ${c}`)].join("\n");
      return { title: slide.title, body: `${left}\n\n${right}` };
    }
    case "code-explainer": {
      const body = [`[${slide.language}]`, slide.codeSnippet, "", ...slide.explanationPoints.map(p => `• ${p}`)].join("\n");
      return { title: slide.title, body };
    }
    case "callout":
      return { title: slide.title, body: slide.content };
    case "step-grid": {
      const steps = [...slide.steps]
        .sort((a, b) => a.stepNumber - b.stepNumber)
        .map(s => `${s.stepNumber}. ${s.title} — ${s.description}`);
      return { title: slide.title, body: steps.join("\n") };
    }
    default: {
      const _exhaustive: never = slide;
      return _exhaustive;
    }
  }
}

/**
 * Builds the lesson's Overview Doc from specifically selected decks and quizzes (not the
 * lesson's own content fields) — each deck/quiz carries its own snapshotted content
 * (SavedProject.slideContent/presentationAST/questions), so the doc always reflects exactly
 * what was picked regardless of what the lesson's fields say now.
 */
export async function buildOverviewDoc(
  lesson: Lesson,
  accessToken: string,
  selectedDecks: SavedProject[],
  selectedQuizzes: SavedProject[],
  sections: SectionDef[] = DEFAULT_SECTIONS
): Promise<string> {
  const docs = google.docs({ version: "v1", auth: getAuthClient(accessToken) });

  const overviewLabel = sections.find(s => s.id === "lessonOverview")?.label ?? "Lesson Overview";
  const doc = await docs.documents.create({
    requestBody: { title: `${overviewLabel.toUpperCase()}: ${lesson.title} — ${lesson.subtitle}` },
  });
  const docId = doc.data.documentId!;

  // Course-level "Include in Overview Doc" toggle — additive on top of the default
  // (learningTargets only), so a course that's never touched the toggle sees identical output.
  const overviewSections = sections.filter(s => s.includeInOverviewDoc);

  const lines: string[] = [
    lesson.title,
    ...(lesson.subtitle ? [lesson.subtitle] : []),
    ...(lesson.deadline ? [`Deadline: ${lesson.deadline}`] : []),
    "",
    ...overviewSections.flatMap(s => [s.label.toUpperCase(), sectionSlideContent(lesson, s.id) ?? "", ""]),
    ...selectedDecks.flatMap(deck => {
      const deckSlides = deck.presentationAST
        ? deck.presentationAST.slides.map(flattenAstSlide)
        : parseSlideContentBlocks(deck.slideContent ?? "");
      return [
        deck.title.toUpperCase(),
        "",
        ...deckSlides.flatMap(s => [s.title, s.body, ""]),
      ];
    }),
    ...selectedQuizzes.flatMap(quiz => [
      quiz.title.toUpperCase(),
      "",
      ...(quiz.questions ?? []).flatMap((q, i) => [
        `${i + 1}. ${q.text}`,
        ...(q.type === "multiple_choice" ? q.options.map(o => `   ${o === q.correctAnswer && o.trim() ? "✓" : "-"} ${o}`) : []),
        "",
      ]),
    ]),
  ];

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [{ insertText: { location: { index: 1 }, text: lines.join("\n") } }],
    },
  });

  return docId;
}

// ─── Forms (Quiz) ────────────────────────────────────────────────────────────

export async function buildQuiz(lesson: Lesson, accessToken: string, folderId?: string): Promise<string> {
  const forms = google.forms({ version: "v1", auth: getAuthClient(accessToken) });

  const form = await forms.forms.create({
    requestBody: { info: { title: `QUIZ: ${lesson.title} — ${lesson.subtitle}` } },
  });
  const formId = form.data.formId!;

  const customQuestions = lesson.quizQuestions?.filter(q => q.text.trim());

  let items: any[];

  if (customQuestions && customQuestions.length > 0) {
    // Use custom questions defined in the lesson
    items = customQuestions.map((q, i) => {
      let questionItem: any;
      if (q.type === "multiple_choice") {
        const opts = q.options.filter(o => o.trim()).map(o => ({ value: o }));
        questionItem = {
          question: {
            required: q.required,
            ...(q.correctAnswer.trim()
              ? { grading: { pointValue: 10, correctAnswers: { answers: [{ value: q.correctAnswer }] } } }
              : {}),
            choiceQuestion: { type: "RADIO", options: opts },
          },
        };
      } else {
        questionItem = {
          question: {
            required: q.required,
            textQuestion: { paragraph: q.type === "paragraph" },
          },
        };
      }
      return { createItem: { item: { title: q.text, questionItem }, location: { index: i } } };
    });
  } else {
    items = [];
  }

  // Must make the form a quiz BEFORE adding graded items — two separate batches.
  // VERIFIED auto-collects the respondent's email from their signed-in Google account — students
  // opening this via Classroom are always signed in, so this identifies submissions without
  // asking them to type anything.
  await forms.forms.batchUpdate({
    formId,
    requestBody: {
      requests: [{
        updateSettings: {
          settings: { quizSettings: { isQuiz: true }, emailCollectionType: "VERIFIED" },
          updateMask: "quizSettings,emailCollectionType",
        },
      }],
    },
  });

  if (items.length > 0) {
    await forms.forms.batchUpdate({
      formId,
      requestBody: { requests: items },
    });
  }

  // Move into the specified Drive folder (course folder)
  if (folderId) {
    const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
    await drive.files.update({
      fileId: formId,
      addParents: folderId,
      removeParents: "root",
      fields: "id, parents",
    });
  }

  return formId;
}

// ─── Selective / download bundle generators ──────────────────────────────────
// Overview Doc is deliberately not part of this bundle — it now requires picking which decks/
// quizzes it summarizes (see buildOverviewDoc above), which doesn't fit a one-click bundle
// action. It has its own dedicated generation path instead (app/lessons/[id]/page.tsx).

type FileChoice = "slides" | "quiz";

export async function generateBundleSelective(
  lesson: Lesson,
  files: FileChoice[],
  accessToken: string,
  templateId?: string,
  sections: SectionDef[] = DEFAULT_SECTIONS,
  parentFolderId?: string
): Promise<{ folderUrl: string; folderId: string; deckId?: string; formId?: string }> {
  const folder = await createFolder(
    `${lesson.title}: ${lesson.subtitle}`,
    accessToken,
    parentFolderId
  );
  const folderId = folder.id!;

  let deckId: string | undefined;
  let formId: string | undefined;

  await Promise.all([
    files.includes("slides") ? buildSlideDeck(lesson, accessToken, templateId, sections).then(id => { deckId = id; }) : null,
    files.includes("quiz")   ? buildQuiz(lesson, accessToken).then(id => { formId = id; })                          : null,
  ]);

  const fileIds = [deckId, formId].filter(Boolean) as string[];
  await Promise.all(fileIds.map(id => moveFileToFolder(id, folderId, accessToken)));

  return { folderUrl: folder.webViewLink!, folderId, deckId, formId };
}

async function exportFileAsPdf(fileId: string, accessToken: string): Promise<Buffer> {
  const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  const res = await drive.files.export(
    { fileId, mimeType: "application/pdf" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function deleteFile(fileId: string, accessToken: string): Promise<void> {
  const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  await drive.files.delete({ fileId });
}

/** Extracts a Drive file id from any of the URL shapes this app generates (Slides/Docs/Forms). */
export function extractDriveFileId(url: string): string | undefined {
  return url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
}

/** Auto-generated deck name — no user input needed. Uses the lesson's own Title/Subtitle so
 * decks are identifiable by content rather than a timestamp (a lesson can have several decks;
 * the lesson page's deck row shows the generation date separately for that reason). Falls back
 * to a timestamped generic name when there's no lesson to name it after (Notes to Slides can
 * export a standalone deck not attached to any lesson). */
export function autoDeckName(lessonTitle?: string, lessonSubtitle?: string): string {
  if (lessonTitle) return lessonSubtitle ? `${lessonTitle} — ${lessonSubtitle}` : lessonTitle;
  const stamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `Slide Deck — ${stamp}`;
}

export async function generateBundleAsDownload(
  lesson: Lesson,
  files: Extract<FileChoice, "slides">[],
  accessToken: string,
  templateId?: string,
  sections: SectionDef[] = DEFAULT_SECTIONS
): Promise<{ filename: string; data: string }[]> {
  if (!files.includes("slides")) return [];

  const fileId = await buildSlideDeck(lesson, accessToken, templateId, sections);
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await exportFileAsPdf(fileId, accessToken);
  } finally {
    await deleteFile(fileId, accessToken).catch(() => {});
  }

  const safeTitle = lesson.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
  return [{ filename: `${safeTitle}_Slides.pdf`, data: pdfBuffer.toString("base64") }];
}

// ─── Google Classroom ───────────────────────────────���──────────────────────

function extractFileId(url: string): string | undefined {
  return url?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
}

export async function listGoogleClassrooms(accessToken: string): Promise<{ id: string; name: string }[]> {
  const classroom = google.classroom({ version: "v1", auth: getAuthClient(accessToken) });
  const res = await classroom.courses.list({ teacherId: "me", courseStates: ["ACTIVE"], pageSize: 50 });
  return (res.data.courses ?? []).map(c => ({ id: c.id!, name: c.name! }));
}

/**
 * Emails of every teacher on a linked Google Classroom course — used to grant Drive folder
 * access to co-teachers who only have access via Classroom (never added as a NeXTScript
 * collaborator). Best-effort: returns [] on failure (e.g. missing scope, no access) so
 * callers can still fall back to sharing with just the course's own recorded members.
 */
export async function listClassroomTeacherEmails(classroomId: string, accessToken: string): Promise<string[]> {
  try {
    const classroom = google.classroom({ version: "v1", auth: getAuthClient(accessToken) });
    const res = await classroom.courses.teachers.list({ courseId: classroomId, pageSize: 100 });
    return (res.data.teachers ?? [])
      .map(t => t.profile?.emailAddress)
      .filter((e): e is string => !!e);
  } catch {
    return [];
  }
}

export async function getOrCreateClassroomTopic(
  classroomId: string,
  topicName: string,
  accessToken: string,
): Promise<string> {
  const classroom = google.classroom({ version: "v1", auth: getAuthClient(accessToken) });
  const { data } = await classroom.courses.topics.list({ courseId: classroomId, pageSize: 100 });
  const existing = (data.topic ?? []).find(t => t.name === topicName);
  if (existing?.topicId) return existing.topicId;
  const created = await classroom.courses.topics.create({
    courseId: classroomId,
    requestBody: { name: topicName },
  });
  return created.data.topicId!;
}

/** Paginates through every courseWorkMaterial in a Classroom course to collect all existing titles. */
async function listAllCourseWorkMaterialTitles(classroom: ReturnType<typeof google.classroom>, courseId: string): Promise<Set<string>> {
  const titles = new Set<string>();
  let pageToken: string | undefined;
  do {
    const res = await classroom.courses.courseWorkMaterials.list({ courseId, pageSize: 250, pageToken });
    (res.data.courseWorkMaterial ?? []).forEach(m => { if (m.title) titles.add(m.title); });
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return titles;
}

/** Paginates through every courseWork item in a Classroom course to collect all existing titles. */
async function listAllCourseWorkTitles(classroom: ReturnType<typeof google.classroom>, courseId: string): Promise<Set<string>> {
  const titles = new Set<string>();
  let pageToken: string | undefined;
  do {
    const res = await classroom.courses.courseWork.list({ courseId, pageSize: 250, pageToken });
    (res.data.courseWork ?? []).forEach(cw => { if (cw.title) titles.add(cw.title); });
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return titles;
}

// Derives the Classroom item type from the lesson's type field.
// assessment → quiz assignment (form is primary); lesson/review → material; everything else → assignment
function classroomItemTypeFor(lessonType?: string): "assignment" | "material" | "quiz" {
  if (lessonType === "assessment") return "quiz";
  if (lessonType === "lesson" || lessonType === "review") return "material";
  return "assignment";
}

export async function pushLessonToClassroom(params: {
  classroomId: string;
  title: string;
  description?: string;
  topicId?: string;
  slidesUrl?: string;
  docUrl?: string;
  formUrl?: string;
  lessonType?: string;
  accessToken: string;
}): Promise<void> {
  const classroom = google.classroom({ version: "v1", auth: getAuthClient(params.accessToken) });
  const itemType = classroomItemTypeFor(params.lessonType);

  const slidesId = params.slidesUrl ? extractFileId(params.slidesUrl) : undefined;
  const docId = params.docUrl ? extractFileId(params.docUrl) : undefined;
  const formId = params.formUrl ? extractFileId(params.formUrl) : undefined;

  if (itemType === "material") {
    // Read-only reference post — no submission required
    const existingTitles = await listAllCourseWorkMaterialTitles(classroom, params.classroomId);
    let title = params.title;
    if (existingTitles.has(title)) title = `${title} (Copy)`;

    const materials: any[] = [];
    if (slidesId) materials.push({ driveFile: { driveFile: { id: slidesId }, shareMode: "VIEW" } });
    if (docId) materials.push({ driveFile: { driveFile: { id: docId }, shareMode: "VIEW" } });
    // Classroom API rejects `form` material on create (read-only, populated by Classroom itself) —
    // a `link` to the form URL is auto-upgraded to a form attachment instead.
    if (formId) materials.push({ link: { url: params.formUrl! } });

    await classroom.courses.courseWorkMaterials.create({
      courseId: params.classroomId,
      requestBody: {
        title,
        ...(params.description ? { description: params.description } : {}),
        state: "DRAFT",
        ...(params.topicId ? { topicId: params.topicId } : {}),
        ...(materials.length > 0 ? { materials } : {}),
      },
    });
    return;
  }

  if (itemType === "quiz") {
    // Assignment where the quiz form is the primary item; slides/doc are supplementary
    const existingTitles = await listAllCourseWorkTitles(classroom, params.classroomId);
    let title = params.title;
    if (existingTitles.has(title)) title = `${title} (Copy)`;

    const materials: any[] = [];
    // Classroom API rejects `form` material on create (read-only, populated by Classroom itself) —
    // a `link` to the form URL is auto-upgraded to a form attachment instead.
    if (formId) materials.push({ link: { url: params.formUrl! } });
    if (slidesId) materials.push({ driveFile: { driveFile: { id: slidesId }, shareMode: "VIEW" } });
    if (docId) materials.push({ driveFile: { driveFile: { id: docId }, shareMode: "VIEW" } });

    await classroom.courses.courseWork.create({
      courseId: params.classroomId,
      requestBody: {
        title,
        ...(params.description ? { description: params.description } : {}),
        state: "DRAFT",
        workType: "ASSIGNMENT",
        ...(params.topicId ? { topicId: params.topicId } : {}),
        ...(materials.length > 0 ? { materials } : {}),
      },
    });
    return;
  }

  // Default: assignment with all attachments
  const existingTitles = await listAllCourseWorkTitles(classroom, params.classroomId);
  let title = params.title;
  if (existingTitles.has(title)) title = `${title} (Copy)`;

  const materials: any[] = [];
  if (slidesId) materials.push({ driveFile: { driveFile: { id: slidesId }, shareMode: "VIEW" } });
  if (docId) materials.push({ driveFile: { driveFile: { id: docId }, shareMode: "VIEW" } });
  if (formId) materials.push({ link: { url: params.formUrl! } });

  await classroom.courses.courseWork.create({
    courseId: params.classroomId,
    requestBody: {
      title,
      ...(params.description ? { description: params.description } : {}),
      state: "DRAFT",
      workType: "ASSIGNMENT",
      ...(params.topicId ? { topicId: params.topicId } : {}),
      ...(materials.length > 0 ? { materials } : {}),
    },
  });
}
