/**
 * Google API helpers — mirrors the bundle generation logic from the Apps Script.
 *
 * Requires a user OAuth access token (stored on the session after sign-in).
 * A Slides template URL can be optionally provided in the Generate modal;
 * if omitted a fresh blank presentation is created instead.
 */

import { google } from "googleapis";
import type { Lesson } from "@/types/lesson";
import type { FormQuestion } from "@/types/form";
import { DEFAULT_SECTION_LABELS, type SectionLabels } from "@/lib/userSettings";

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

async function moveFileToFolder(fileId: string, folderId: string, accessToken: string) {
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

export async function buildQuiz(lesson: Lesson, accessToken: string): Promise<string> {
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
): Promise<{ folderUrl: string; deckId?: string; docId?: string; formId?: string }> {
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

  return { folderUrl: folder.webViewLink!, deckId, docId, formId };
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

export async function pushLessonToClassroom(params: {
  classroomId: string;
  title: string;
  description?: string;
  topicId?: string;
  slidesUrl?: string;
  docUrl?: string;
  accessToken: string;
}): Promise<void> {
  const classroom = google.classroom({ version: "v1", auth: getAuthClient(params.accessToken) });

  // Duplicate detection — auto-suffix with (Copy) if title already exists
  const existing = await classroom.courses.courseWork.list({ courseId: params.classroomId, pageSize: 250 });
  const existingTitles = new Set((existing.data.courseWork ?? []).map(cw => cw.title));
  let title = params.title;
  if (existingTitles.has(title)) title = `${title} (Copy)`;

  const materials: any[] = [];
  const slidesId = params.slidesUrl ? extractFileId(params.slidesUrl) : undefined;
  const docId = params.docUrl ? extractFileId(params.docUrl) : undefined;
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
}
