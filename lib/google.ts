/**
 * Google API helpers: Drive folders and files, the Overview Doc, quiz Forms and Classroom.
 * Slide decks come from Notes to Slides (lib/deck/render/*), not from here.
 *
 * Requires a user OAuth access token (stored on the session after sign-in).
 */

import { google } from "googleapis";
import { Readable } from "stream";
import type { Lesson } from "@/types/lesson";
import { DEFAULT_SECTIONS, type SectionDef } from "@/types/section";
import { getSectionContent } from "@/lib/sections";
import { parseClassicSlideBlocks } from "@/lib/lessonSeed";
import type { SavedProject } from "@/types/project";
import type { SlideNode } from "@/types/slideAst";

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
  // supportsAllDrives is required for both calls whenever the file lives in a Shared Drive —
  // without it, files.get 404s ("File not found") on a file that does exist, and files.update's
  // removeParents is silently ignored, so the addParents looks like it would create a second
  // parent, which Shared Drives reject ("Increasing the number of parents is not allowed").
  const file = await drive.files.get({
    fileId,
    fields: "parents, trashed, ownedByMe, capabilities(canEdit, canMoveItemWithinDrive)",
    supportsAllDrives: true,
  });
  const prevParents = (file.data.parents || []).join(",");
  // Already in place — re-issuing addParents/removeParents with the same id in both can itself
  // trigger "Increasing the number of parents is not allowed" on some files, so skip instead of
  // repeating a no-op move every time the repair tool is re-run.
  if (prevParents === folderId) return;
  try {
    await drive.files.update({
      fileId,
      addParents: folderId,
      removeParents: prevParents,
      fields: "id, parents",
      supportsAllDrives: true,
    });
  } catch (err: any) {
    const detail = `parents=[${prevParents || "none"}] trashed=${file.data.trashed} ownedByMe=${file.data.ownedByMe} canEdit=${file.data.capabilities?.canEdit}`;
    err.message = `${err.message} (${detail})`;
    throw err;
  }
}

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Uploads a .pptx file (as produced by lib/deck/render/pptx.ts) to Drive as a real PowerPoint file —
 * deliberately not converted to native Google Slides format, since that conversion is lossy.
 * Drive/Slides can open and edit a .pptx in place without conversion. */
export const GOOGLE_SLIDES_MIME = "application/vnd.google-apps.presentation";

/**
 * Uploads a .pptx to Drive. With `convertToSlides`, Drive converts it to an editable Google
 * Slides deck on the way in (speaker notes survive the conversion).
 */
export async function uploadPptxToDrive(
  buffer: Buffer,
  name: string,
  accessToken: string,
  opts: { convertToSlides?: boolean } = {},
): Promise<{ id: string; webViewLink: string }> {
  const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  const res = await drive.files.create({
    requestBody: { name, mimeType: opts.convertToSlides ? GOOGLE_SLIDES_MIME : PPTX_MIME },
    media: { mimeType: PPTX_MIME, body: Readable.from(buffer) },
    fields: "id, webViewLink",
  });
  return { id: res.data.id!, webViewLink: res.data.webViewLink! };
}

// ─── Slides ─────────────────────────────────────────────────────────────────

/** Strip leading bullet characters from every line. */
export function stripBullets(text: string): string {
  return text.replace(/^[•\-\*]\s*/gm, "").trim();
}

// ─── Docs (Assessment/Assignment Sheet) ──────────────────────────────────────

/** getSectionContent() plus the legacy taChecklist fallback for the rubric on old lessons. */
function sectionDocContent(lesson: Lesson, sectionId: string): string {
  return sectionId === "rubric" ? lesson.rubric ?? (lesson as any).taChecklist ?? "" : getSectionContent(lesson, sectionId);
}

/** Flattens one AST slide node (any layout type, see types/slideAst.ts) into plain
 * {title, body} text. Used by the Overview Doc to summarize a Notes-to-Slides deck. */
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
      const output = slide.output?.trim() ? ["Output:", slide.output.trim(), ""] : [];
      const body = [`[${slide.language}]`, slide.codeSnippet, "", ...output, ...slide.explanationPoints.map(p => `• ${p}`)].join("\n");
      return { title: slide.title, body };
    }
    case "callout":
      return { title: slide.title, body: slide.content };
    case "card-row":
      return { title: slide.title, body: slide.cards.map(c => `• ${c.heading}${c.tag ? ` (${c.tag})` : ""}: ${c.body}`).join("\n") };
    case "table":
      return { title: slide.title, body: [slide.columns.join(" | "), ...slide.rows.map(r => r.join(" | "))].join("\n") };
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
    ...overviewSections.flatMap(s => [s.label.toUpperCase(), sectionDocContent(lesson, s.id) ?? "", ""]),
    ...selectedDecks.flatMap(deck => {
      const deckSlides = deck.presentationAST
        ? deck.presentationAST.slides.map(flattenAstSlide)
        : parseClassicSlideBlocks(deck.slideContent ?? "");
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
