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
import { DEFAULT_SECTION_LABELS, type SectionLabels } from "@/lib/userSettings";
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
  accessToken: string
): Promise<void> {
  const acting = actingEmail.toLowerCase();
  const seen = new Set<string>();
  const recipients = [course.userId, ...(course.collaborators ?? [])].filter((email) => {
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

export async function buildSlideDeck(lesson: Lesson, accessToken: string, templateId?: string, labels: SectionLabels = DEFAULT_SECTION_LABELS): Promise<string> {
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

  // 2. Fetch the presentation to read existing title-slide shape IDs and master layouts
  const pres = await slides.presentations.get({ presentationId: deckId });
  const titleSlide = (pres.data.slides || [])[0];

  // Find a blank-ish layout from the template master to use for the success slide
  const masterLayouts = ((pres.data.masters || [])[0] as any)?.layouts || [];
  const blankLayout = masterLayouts.find(
    (l: any) => l.layoutProperties?.name?.toLowerCase().includes("blank")
  ) ?? masterLayouts[masterLayouts.length - 1] ?? null;

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
        titleRequests.push(...replaceText(el.objectId!, `Goal: ${lesson.overview.replace(/\n+/g, " ")}`, hasContent));
      } else if (text.includes("reminder:")) {
        titleRequests.push(...replaceText(el.objectId!, `Reminder: ${lesson.submissionChecklist.replace(/\n+/g, " · ")}`, hasContent));
      }
    }
  }

  // ── Section slides — matches Google Doc template order ──────────────────
  const contentRequests: any[] = [
    ...slideRequests(labels.lessonOverview.toUpperCase(),  lesson.overview),
    ...slideRequests(labels.learningTargets.toUpperCase(), lesson.learningTargets),
    ...(lesson.vocabulary ? slideRequests(labels.vocabulary.toUpperCase(), lesson.vocabulary) : []),
    ...slideRequests(labels.warmUp.toUpperCase(),          lesson.warmUp),
  ];

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
  contentRequests.push(
    ...slideRequests(labels.guidedLab.toUpperCase(),              lesson.guidedLab),
    ...slideRequests(labels.selfPaced.toUpperCase(),              lesson.selfPaced),
    ...slideRequests(labels.submissionChecklist.toUpperCase(),    lesson.submissionChecklist),
    ...slideRequests(labels.checkpoint.toUpperCase(),             lesson.checkpoint),
    ...slideRequests(labels.industryBestPractices.toUpperCase(),  lesson.industryBestPractices),
    ...slideRequests(labels.devJournalPrompt.toUpperCase(),       lesson.devJournalPrompt),
    ...slideRequests(labels.rubric.toUpperCase(),                 getRubric(lesson)),
  );

  // ── Success slide ───────────────────────────────────────────────────────
  const successSlideId = uid("ss");
  const successTextId  = uid("st");
  contentRequests.push(
    {
      createSlide: {
        objectId: successSlideId,
        ...(blankLayout?.objectId ? { slideLayoutReference: { layoutId: blankLayout.objectId } } : {}),
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

const AST_ACCENT_CYAN:   RgbColor = { red: 0.047, green: 0.753, blue: 0.874 }; // #0cc0df
const AST_ACCENT_ORANGE: RgbColor = { red: 1,     green: 0.549, blue: 0.290 }; // #ff8c4a
const AST_ACCENT_PURPLE: RgbColor = { red: 0.388, green: 0.400, blue: 0.945 }; // #6366f1
const AST_TEXT_PRIMARY:   RgbColor = { red: 0.051, green: 0.082, blue: 0.188 }; // #0d1530
const AST_TEXT_SECONDARY: RgbColor = { red: 0.176, green: 0.231, blue: 0.369 }; // #2d3b5e
const AST_CARD_BG:        RgbColor = { red: 0.937, green: 0.945, blue: 0.969 }; // #eef0f7
const AST_CODE_PANEL_BG:  RgbColor = { red: 0.051, green: 0.067, blue: 0.090 }; // #0d1117
const AST_CODE_LABEL:     RgbColor = { red: 0.6,   green: 0.62,  blue: 0.66 };
const AST_WHITE:           RgbColor = { red: 1, green: 1, blue: 1 };
const AST_WARNING_BG: RgbColor = { red: 1,     green: 0.937, blue: 0.898 }; // ~#fff0e6
const AST_TIP_BG:     RgbColor = { red: 0.882, green: 0.976, blue: 0.988 }; // ~#e1f9fc
const AST_NOTE_BG:    RgbColor = { red: 0.925, green: 0.925, blue: 0.996 }; // ~#ecebfe

const AST_CALLOUT_VARIANTS: Record<CalloutCardSlide["variant"], { label: string; accent: RgbColor; bg: RgbColor }> = {
  warning:            { label: "HEADS UP",         accent: AST_ACCENT_ORANGE, bg: AST_WARNING_BG },
  tip:                { label: "PRO TIP",           accent: AST_ACCENT_CYAN,   bg: AST_TIP_BG },
  "instructor-note":  { label: "INSTRUCTOR NOTE",  accent: AST_ACCENT_PURPLE, bg: AST_NOTE_BG },
};

function astCreateBlankSlideRequest(slideId: string, blankLayout: slides_v1.Schema$Page | null): SlideRequest {
  return {
    createSlide: {
      objectId: slideId,
      ...(blankLayout?.objectId ? { slideLayoutReference: { layoutId: blankLayout.objectId } } : {}),
    },
  };
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
function astTitleHeader(slideId: string, title: string, subtitle?: string): { requests: SlideRequest[]; contentStartY: number } {
  const requests: SlideRequest[] = [];
  const titleId = uid("t");
  requests.push(
    astShapeRequest(titleId, slideId, "TEXT_BOX", AST_MARGIN, 28, AST_CONTENT_WIDTH, 50),
    astInsertText(titleId, title),
    astTextStyle(titleId, { bold: true, fontSize: { magnitude: 22, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: AST_TEXT_PRIMARY } } }, "bold,fontSize,foregroundColor"),
  );

  let y = 80;
  if (subtitle) {
    const subId = uid("st");
    requests.push(
      astShapeRequest(subId, slideId, "TEXT_BOX", AST_MARGIN, y, AST_CONTENT_WIDTH, 24),
      astInsertText(subId, subtitle),
      astTextStyle(subId, { italic: true, fontSize: { magnitude: 13, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: AST_TEXT_SECONDARY } } }, "italic,fontSize,foregroundColor"),
    );
    y += 30;
  }

  return { requests, contentStartY: y + 6 };
}

function astStandardSlideRequests(slide: StandardTextSlide, blankLayout: slides_v1.Schema$Page | null): SlideRequest[] {
  const slideId = uid("s");
  const requests: SlideRequest[] = [astCreateBlankSlideRequest(slideId, blankLayout)];
  const { requests: headerReqs, contentStartY } = astTitleHeader(slideId, slide.title, slide.subtitle);
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
      astTextStyle(bodyId, { fontSize: { magnitude: 13, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: AST_TEXT_SECONDARY } } }, "fontSize,foregroundColor"),
    );
    if (bulletStart >= 0) {
      requests.push(astBullets(bodyId, { type: "FIXED_RANGE", startIndex: bulletStart, endIndex: fullText.length }));
    }
  }

  return requests;
}

function astSplitColumnSlideRequests(slide: SplitColumnSlide, blankLayout: slides_v1.Schema$Page | null): SlideRequest[] {
  const slideId = uid("s");
  const requests: SlideRequest[] = [astCreateBlankSlideRequest(slideId, blankLayout)];
  const { requests: headerReqs, contentStartY } = astTitleHeader(slideId, slide.title, slide.subtitle);
  requests.push(...headerReqs);

  const gap = 20;
  const colWidth = (AST_CONTENT_WIDTH - gap) / 2;
  const colHeight = AST_PAGE_HEIGHT - contentStartY - AST_MARGIN;

  function column(x: number, heading: string, content: string[], accent: RgbColor) {
    const items = content.map(stripBullets).filter(Boolean);
    const cardId = uid("c");
    requests.push(
      astShapeRequest(cardId, slideId, "ROUND_RECTANGLE", x, contentStartY, colWidth, colHeight),
      astShapeFill(cardId, AST_CARD_BG),
    );
    const headingLine = heading.toUpperCase();
    const text = items.length > 0 ? `${headingLine}\n${items.join("\n")}` : headingLine;
    requests.push(
      astInsertText(cardId, text),
      astTextStyle(cardId, { bold: true, fontSize: { magnitude: 11, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: accent } } }, "bold,fontSize,foregroundColor", { type: "FIXED_RANGE", startIndex: 0, endIndex: headingLine.length }),
    );
    if (items.length > 0) {
      requests.push(
        astTextStyle(cardId, { fontSize: { magnitude: 12, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: AST_TEXT_SECONDARY } } }, "fontSize,foregroundColor", { type: "FIXED_RANGE", startIndex: headingLine.length + 1, endIndex: text.length }),
        astBullets(cardId, { type: "FIXED_RANGE", startIndex: headingLine.length + 1, endIndex: text.length }),
      );
    }
  }

  column(AST_MARGIN, slide.leftColumn.heading, slide.leftColumn.content, AST_ACCENT_CYAN);
  column(AST_MARGIN + colWidth + gap, slide.rightColumn.heading, slide.rightColumn.content, AST_ACCENT_ORANGE);

  return requests;
}

function astCodeExplainerSlideRequests(slide: CodeExplainerSlide, blankLayout: slides_v1.Schema$Page | null): SlideRequest[] {
  const slideId = uid("s");
  const requests: SlideRequest[] = [astCreateBlankSlideRequest(slideId, blankLayout)];
  const { requests: headerReqs, contentStartY } = astTitleHeader(slideId, slide.title, slide.subtitle);
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
    astTextStyle(explId, { bold: true, fontSize: { magnitude: 11, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: AST_ACCENT_CYAN } } }, "bold,fontSize,foregroundColor", { type: "FIXED_RANGE", startIndex: 0, endIndex: explHeading.length }),
  );
  if (points.length > 0) {
    requests.push(
      astTextStyle(explId, { fontSize: { magnitude: 12, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: AST_TEXT_SECONDARY } } }, "fontSize,foregroundColor", { type: "FIXED_RANGE", startIndex: explHeading.length + 1, endIndex: explText.length }),
      astBullets(explId, { type: "FIXED_RANGE", startIndex: explHeading.length + 1, endIndex: explText.length }),
    );
  }

  return requests;
}

function astCalloutSlideRequests(slide: CalloutCardSlide, blankLayout: slides_v1.Schema$Page | null): SlideRequest[] {
  const slideId = uid("s");
  const requests: SlideRequest[] = [astCreateBlankSlideRequest(slideId, blankLayout)];
  const config = AST_CALLOUT_VARIANTS[slide.variant];

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
    astTextStyle(titleId, { bold: true, fontSize: { magnitude: 22, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: AST_TEXT_PRIMARY } } }, "bold,fontSize,foregroundColor"),
    astParagraphAlign(titleId, "CENTER"),
  );
  y += 48;

  if (slide.subtitle) {
    const subId = uid("sub");
    requests.push(
      astShapeRequest(subId, slideId, "TEXT_BOX", panelX, y, panelW, 24),
      astInsertText(subId, slide.subtitle),
      astTextStyle(subId, { italic: true, fontSize: { magnitude: 13, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: AST_TEXT_SECONDARY } } }, "italic,fontSize,foregroundColor"),
      astParagraphAlign(subId, "CENTER"),
    );
    y += 30;
  }

  const contentId = uid("content");
  const contentH = Math.max(panelY + panelH - y - 20, 40);
  requests.push(
    astShapeRequest(contentId, slideId, "TEXT_BOX", panelX + 30, y, panelW - 60, contentH),
    astInsertText(contentId, slide.content),
    astTextStyle(contentId, { fontSize: { magnitude: 14, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: AST_TEXT_PRIMARY } } }, "fontSize,foregroundColor"),
    astParagraphAlign(contentId, "CENTER"),
  );

  return requests;
}

function astStepGridSlideRequests(slide: StepGridSlide, blankLayout: slides_v1.Schema$Page | null): SlideRequest[] {
  const slideId = uid("s");
  const requests: SlideRequest[] = [astCreateBlankSlideRequest(slideId, blankLayout)];
  const { requests: headerReqs, contentStartY } = astTitleHeader(slideId, slide.title, slide.subtitle);
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
      astShapeFill(cardId, AST_CARD_BG),
      astInsertText(cardId, text),
      astTextStyle(cardId, { bold: true, fontSize: { magnitude: 12, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: AST_TEXT_PRIMARY } } }, "bold,fontSize,foregroundColor", { type: "FIXED_RANGE", startIndex: 0, endIndex: heading.length }),
      astTextStyle(cardId, { fontSize: { magnitude: 11, unit: "PT" }, foregroundColor: { opaqueColor: { rgbColor: AST_TEXT_SECONDARY } } }, "fontSize,foregroundColor", { type: "FIXED_RANGE", startIndex: heading.length + 1, endIndex: text.length }),
    );
  });

  return requests;
}

/** Routes a single AST node to its request-builder — mirrors the exhaustive switch in components/slides/SlideRenderer.tsx. */
function astSlideRequests(slide: SlideNode, blankLayout: slides_v1.Schema$Page | null): SlideRequest[] {
  switch (slide.type) {
    case "standard": return astStandardSlideRequests(slide, blankLayout);
    case "split-column": return astSplitColumnSlideRequests(slide, blankLayout);
    case "code-explainer": return astCodeExplainerSlideRequests(slide, blankLayout);
    case "callout": return astCalloutSlideRequests(slide, blankLayout);
    case "step-grid": return astStepGridSlideRequests(slide, blankLayout);
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
export async function buildSlideDeckFromAst(ast: PresentationAST, accessToken: string, templateId?: string): Promise<string> {
  _idSeq = 0; // reset counter for each deck build
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

  // 2. Fetch the presentation to read existing slides/masters
  const pres = await slides.presentations.get({ presentationId: deckId });
  // `layouts` isn't modeled on Schema$Page even though that's where the API actually nests it
  // under a master — same `as any` traversal buildSlideDeck's success-slide lookup uses above.
  const masterLayouts = ((pres.data.masters || [])[0] as any)?.layouts || [];
  const blankLayout: slides_v1.Schema$Page | null =
    masterLayouts.find((l: any) => l.layoutProperties?.name?.toLowerCase().includes("blank"))
    ?? masterLayouts[masterLayouts.length - 1]
    ?? null;
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
  const contentRequests: SlideRequest[] = [];
  for (const slide of ast.slides) {
    contentRequests.push(...astSlideRequests(slide, blankLayout));
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

export async function buildPosterDoc(lesson: Lesson, accessToken: string, labels: SectionLabels = DEFAULT_SECTION_LABELS): Promise<string> {
  const docs  = google.docs({ version: "v1", auth: getAuthClient(accessToken) });

  const doc = await docs.documents.create({
    requestBody: { title: `OVERVIEW: ${lesson.title} — ${lesson.subtitle}` },
  });
  const docId = doc.data.documentId!;

  const text = [
    lesson.title,
    lesson.subtitle,
    `Deadline: ${lesson.deadline}`,
    "",
    "VOCABULARY",
    stripBullets(lesson.vocabulary ?? ""),
    "",
    "LEARNING TARGETS",
    stripBullets(lesson.learningTargets),
    "",
    labels.submissionChecklist.toUpperCase(),
    stripBullets(lesson.submissionChecklist),
    "",
    labels.devJournalPrompt.toUpperCase(),
    stripBullets(lesson.devJournalPrompt),
  ].join("\n");

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        { insertText: { location: { index: 1 }, text } },
      ],
    },
  });

  return docId;
}

export async function buildOverviewDoc(lesson: Lesson, accessToken: string, labels: SectionLabels = DEFAULT_SECTION_LABELS): Promise<string> {
  const docs = google.docs({ version: "v1", auth: getAuthClient(accessToken) });

  const doc = await docs.documents.create({
    requestBody: { title: `${labels.lessonOverview.toUpperCase()}: ${lesson.title} — ${lesson.subtitle}` },
  });
  const docId = doc.data.documentId!;

  // Parse slides from slideContent and filter by overviewSlides mask
  const sep = /\n---\n/;
  const raw = lesson.slideContent ?? "";
  const blocks = sep.test(raw) ? raw.split(sep) : raw.split(/\n\n+/);
  const allSlides = blocks.map(block => {
    const lines = block.trim().split("\n");
    return { title: lines[0] ?? "", body: lines.slice(1).join("\n").trim() };
  }).filter(s => s.title);

  const mask = lesson.overviewSlides;
  const selectedSlides = mask
    ? allSlides.filter((_, i) => mask[i] !== false)
    : allSlides;

  const lines: string[] = [
    lesson.title,
    ...(lesson.subtitle ? [lesson.subtitle] : []),
    ...(lesson.deadline ? [`Deadline: ${lesson.deadline}`] : []),
    "",
    labels.learningTargets.toUpperCase(),
    lesson.learningTargets ?? "",
    "",
    "LESSON SUMMARY",
    ...selectedSlides.flatMap(slide => [
      slide.title,
      slide.body,
      "",
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
  await forms.forms.batchUpdate({
    formId,
    requestBody: {
      requests: [{ updateSettings: { settings: { quizSettings: { isQuiz: true } }, updateMask: "quizSettings" } }],
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

type FileChoice = "slides" | "doc" | "quiz";

export async function generateBundleSelective(
  lesson: Lesson,
  files: FileChoice[],
  accessToken: string,
  templateId?: string,
  labels: SectionLabels = DEFAULT_SECTION_LABELS,
  parentFolderId?: string
): Promise<{ folderUrl: string; folderId: string; deckId?: string; docId?: string; formId?: string }> {
  const folder = await createFolder(
    `${lesson.title}: ${lesson.subtitle}`,
    accessToken,
    parentFolderId
  );
  const folderId = folder.id!;

  let deckId: string | undefined;
  let docId: string | undefined;
  let formId: string | undefined;

  await Promise.all([
    files.includes("slides") ? buildSlideDeck(lesson, accessToken, templateId, labels).then(id => { deckId = id; }) : null,
    files.includes("doc")    ? buildOverviewDoc(lesson, accessToken, labels).then(id => { docId = id; })              : null,
    files.includes("quiz")   ? buildQuiz(lesson, accessToken).then(id => { formId = id; })                          : null,
  ]);

  const fileIds = [deckId, docId, formId].filter(Boolean) as string[];
  await Promise.all(fileIds.map(id => moveFileToFolder(id, folderId, accessToken)));

  return { folderUrl: folder.webViewLink!, folderId, deckId, docId, formId };
}

async function exportFileAsPdf(fileId: string, accessToken: string): Promise<Buffer> {
  const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  const res = await drive.files.export(
    { fileId, mimeType: "application/pdf" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

async function deleteFile(fileId: string, accessToken: string): Promise<void> {
  const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  await drive.files.delete({ fileId });
}

export async function generateBundleAsDownload(
  lesson: Lesson,
  files: Exclude<FileChoice, "quiz">[],
  accessToken: string,
  templateId?: string,
  labels: SectionLabels = DEFAULT_SECTION_LABELS
): Promise<{ filename: string; data: string }[]> {
  const createTasks: { key: string; promise: Promise<string> }[] = [];
  if (files.includes("slides")) createTasks.push({ key: "slides", promise: buildSlideDeck(lesson, accessToken, templateId, labels) });
  if (files.includes("doc"))    createTasks.push({ key: "doc",    promise: buildOverviewDoc(lesson, accessToken, labels) });

  const fileIds = await Promise.all(createTasks.map(t => t.promise));

  const results = await Promise.all(
    fileIds.map(async (fileId, i) => {
      const key = createTasks[i].key;
      try {
        const pdfBuffer = await exportFileAsPdf(fileId, accessToken);
        return { key, pdfBuffer };
      } finally {
        await deleteFile(fileId, accessToken).catch(() => {});
      }
    })
  );

  const safeTitle = lesson.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
  return results.map(({ key, pdfBuffer }) => ({
    filename: `${safeTitle}_${key === "slides" ? "Slides" : "Assessment_Doc"}.pdf`,
    data: pdfBuffer.toString("base64"),
  }));
}

// ─── Main bundle generator ───────────────────────────────────────────────────

export async function generateBundle(
  lesson: Lesson,
  accessToken: string
): Promise<{ folderUrl: string; slideCount: number }> {
  const folder = await createFolder(
    `${lesson.title}: ${lesson.subtitle}`,
    accessToken
  );
  const folderId = folder.id!;

  const [deckId, docId, formId] = await Promise.all([
    buildSlideDeck(lesson, accessToken),
    buildOverviewDoc(lesson, accessToken),
    buildQuiz(lesson, accessToken),
  ]);

  await Promise.all([
    moveFileToFolder(deckId, folderId, accessToken),
    moveFileToFolder(docId, folderId, accessToken),
    moveFileToFolder(formId, folderId, accessToken),
  ]);

  return { folderUrl: folder.webViewLink!, slideCount: 0 };
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
