/**
 * Google API helpers — mirrors the bundle generation logic from the Apps Script.
 *
 * Requires a user OAuth access token (stored on the session after sign-in).
 * The template Slides deck ID comes from SLIDES_TEMPLATE_ID in .env.local.
 */

import { google } from "googleapis";
import type { Lesson } from "@/types/lesson";
import type { FormQuestion } from "@/types/form";

function getAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

// ─── Drive ─────────────────────────────────────────────────────────────────

export async function createFolder(name: string, accessToken: string) {
  const drive = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id, webViewLink",
  });
  return res.data;
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

/**
 * Build one TITLE_AND_BODY slide's worth of API requests.
 * Body text wrapped in backticks is rendered in blue (code examples).
 * All other body text is rendered in black.
 */
function slideRequests(title: string, body: string | undefined): any[] {
  const sId = uid("s");
  const tId = uid("t");
  const bId = uid("b");
  const { plain: bodyPlain, codeRanges } = parseCodeSegments(body ?? "");

  const requests: any[] = [
    {
      createSlide: {
        objectId: sId,
        slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: "TITLE" }, objectId: tId },
          { layoutPlaceholder: { type: "BODY"  }, objectId: bId },
        ],
      },
    },
    { insertText: { objectId: tId, insertionIndex: 0, text: title } },
  ];

  if (bodyPlain.length > 0) {
    requests.push(
      { insertText: { objectId: bId, insertionIndex: 0, text: bodyPlain } },
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

export async function buildSlideDeck(lesson: Lesson, accessToken: string, templateId?: string): Promise<string> {
  _idSeq = 0; // reset counter for each deck build
  const drive  = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  const slides = google.slides({ version: "v1", auth: getAuthClient(accessToken) });

  const resolvedTemplateId = templateId ?? process.env.SLIDES_TEMPLATE_ID!;

  // 1. Copy the template, naming it with both title and subtitle
  const copy = await drive.files.copy({
    fileId: resolvedTemplateId,
    requestBody: { name: `Deck: ${lesson.title} — ${lesson.subtitle}` },
    fields: "id",
  });
  const deckId = copy.data.id!;

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
        titleRequests.push(...replaceText(el.objectId!, `Goal: ${lesson.overview}`, hasContent));
      } else if (text.includes("reminder:")) {
        titleRequests.push(...replaceText(el.objectId!, `Reminder:\n${lesson.submissionChecklist}`, hasContent));
      }
    }
  }

  // ── Section slides — matches Google Doc template order ──────────────────
  const contentRequests: any[] = [
    ...slideRequests("LESSON OVERVIEW",   lesson.overview),
    ...slideRequests("LEARNING TARGETS",  lesson.learningTargets),
    ...slideRequests("WARM-UP",           lesson.warmUp),
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
    ...slideRequests("GUIDED LAB",              lesson.guidedLab),
    ...slideRequests("SELF-PACED",              lesson.selfPaced),
    ...slideRequests("SUBMISSION CHECKLIST",    lesson.submissionChecklist),
    ...slideRequests("CHECKPOINT",              lesson.checkpoint),
    ...slideRequests("INDUSTRY BEST PRACTICES", lesson.industryBestPractices),
    ...slideRequests("DEVELOPMENT JOURNAL",     lesson.devJournalPrompt),
    ...slideRequests("RUBRIC",                  getRubric(lesson)),
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

export async function buildPosterDoc(lesson: Lesson, accessToken: string): Promise<string> {
  const docs  = google.docs({ version: "v1", auth: getAuthClient(accessToken) });

  const doc = await docs.documents.create({
    requestBody: { title: `ASSESSMENT & ASSIGNMENT: ${lesson.title} — ${lesson.subtitle}` },
  });
  const docId = doc.data.documentId!;

  const text = [
    lesson.title,
    lesson.subtitle,
    `Deadline: ${lesson.deadline}`,
    "",
    "──────────────────────────────────────",
    "LEARNING OBJECTIVES",
    "──────────────────────────────────────",
    lesson.learningTargets,
    "",
    "──────────────────────────────────────",
    "STEP-BY-STEP TASKS",
    "──────────────────────────────────────",
    "Guided Lab (In-Class Exercise)",
    lesson.guidedLab,
    "",
    "Self-Paced (Independent Work)",
    lesson.selfPaced,
    "",
    "──────────────────────────────────────",
    "GRADING CHECKLIST",
    "──────────────────────────────────────",
    lesson.submissionChecklist,
    "",
    "──────────────────────────────────────",
    "SUBMISSION INSTRUCTIONS",
    "──────────────────────────────────────",
    "Complete all items in the grading checklist above before submitting.",
    `Deadline: ${lesson.deadline}`,
    "",
    "──────────────────────────────────────",
    "SOURCES",
    "──────────────────────────────────────",
    lesson.sources,
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
    // Auto-generate from rubric (legacy fallback)
    const checklistItems = getRubric(lesson)
      .split("\n")
      .map((line) => line.replace(/^[\s☐✓\-\*•]+/, "").trim())
      .filter(Boolean)
      .slice(0, 10);

    const mcItems: any[] = checklistItems.map((item, i) => ({
      createItem: {
        item: {
          title: `Which statement best describes the following: "${item}"?`,
          questionItem: {
            question: {
              grading: { pointValue: 10, correctAnswers: { answers: [{ value: "This is the industry-standard approach" }] } },
              choiceQuestion: {
                type: "RADIO",
                options: [
                  { value: "This is the industry-standard approach" },
                  { value: "This is an outdated legacy approach" },
                  { value: "This only applies to specific frameworks" },
                  { value: "This is not recommended practice" },
                ],
              },
            },
          },
        },
        location: { index: i },
      },
    }));

    const firstTarget = lesson.learningTargets.split("\n").find((l) => l.trim()) || "a key concept from this lesson";
    const shortAnswers: any[] = [
      {
        createItem: {
          item: {
            title: "Describe your debugging process when you encounter an error in your code.",
            questionItem: { question: { required: true, textQuestion: { paragraph: true } } },
          },
          location: { index: checklistItems.length },
        },
      },
      {
        createItem: {
          item: {
            title: `Explain how you would apply this concept in a real project: ${firstTarget.trim()}`,
            questionItem: { question: { required: true, textQuestion: { paragraph: true } } },
          },
          location: { index: checklistItems.length + 1 },
        },
      },
    ];
    items = [...mcItems, ...shortAnswers];
  }

  // Must make the form a quiz BEFORE adding graded items — two separate batches.
  await forms.forms.batchUpdate({
    formId,
    requestBody: {
      requests: [{ updateSettings: { settings: { quizSettings: { isQuiz: true } }, updateMask: "quizSettings" } }],
    },
  });

  await forms.forms.batchUpdate({
    formId,
    requestBody: { requests: items },
  });

  return formId;
}

// ─── Standalone Slide Deck ────────────────────────────────────────────────────

export interface StandaloneSlide {
  title: string;
  body: string;
}

export async function buildStandaloneSlides(
  deckTitle: string,
  deckSubtitle: string,
  slideList: StandaloneSlide[],
  accessToken: string,
  templateId?: string
): Promise<string> {
  _idSeq = 0;
  const drive  = google.drive({ version: "v3", auth: getAuthClient(accessToken) });
  const slides = google.slides({ version: "v1", auth: getAuthClient(accessToken) });

  const resolvedTemplateId = templateId ?? process.env.SLIDES_TEMPLATE_ID!;

  const copy = await drive.files.copy({
    fileId: resolvedTemplateId,
    requestBody: { name: deckTitle },
    fields: "id",
  });
  const deckId = copy.data.id!;

  const pres = await slides.presentations.get({ presentationId: deckId });
  const titleSlide = (pres.data.slides || [])[0];
  const masterLayouts = ((pres.data.masters || [])[0] as any)?.layouts || [];
  const blankLayout = masterLayouts.find(
    (l: any) => l.layoutProperties?.name?.toLowerCase().includes("blank")
  ) ?? masterLayouts[masterLayouts.length - 1] ?? null;

  // Fill title slide
  const titleRequests: any[] = [];
  if (titleSlide) {
    for (const el of titleSlide.pageElements || []) {
      const placeholderType = el.shape?.placeholder?.type as string | undefined;
      const text = el.shape?.text?.textElements?.map((t: any) => t.textRun?.content || "").join("") ?? "";
      const hasContent = text.length > 0;
      if (placeholderType === "CENTERED_TITLE" || placeholderType === "TITLE") {
        titleRequests.push(...replaceText(el.objectId!, deckTitle, hasContent));
      } else if (placeholderType === "SUBTITLE") {
        titleRequests.push(...replaceText(el.objectId!, deckSubtitle, hasContent));
      }
    }
  }

  // Build content slides
  const contentRequests: any[] = [];
  for (const slide of slideList) {
    if (!slide.title.trim() && !slide.body.trim()) continue;
    contentRequests.push(...slideRequests(slide.title, slide.body));
  }

  // Success slide
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
    { insertText: { objectId: successTextId, insertionIndex: 0, text: deckTitle.toUpperCase() } },
    {
      updateTextStyle: {
        objectId: successTextId,
        textRange: { type: "ALL" },
        style: { bold: true, fontSize: { magnitude: 40, unit: "PT" } },
        fields: "bold,fontSize",
      },
    },
  );

  if (titleRequests.length > 0) {
    await slides.presentations.batchUpdate({ presentationId: deckId, requestBody: { requests: titleRequests } });
  }
  await slides.presentations.batchUpdate({ presentationId: deckId, requestBody: { requests: contentRequests } });

  return deckId;
}

// ─── Standalone Custom Form ───────────────────────────────────────────────────

export async function buildCustomForm(
  title: string,
  description: string,
  questions: FormQuestion[],
  accessToken: string,
  isQuiz: boolean
): Promise<string> {
  const forms = google.forms({ version: "v1", auth: getAuthClient(accessToken) });

  const form = await forms.forms.create({ requestBody: { info: { title, description } } });
  const formId = form.data.formId!;

  const validQuestions = questions.filter(q => q.text.trim());
  const items: any[] = validQuestions.map((q, i) => {
    let questionItem: any;
    if (q.type === "multiple_choice") {
      const opts = q.options.filter(o => o.trim()).map(o => ({ value: o }));
      questionItem = {
        question: {
          required: q.required,
          ...(isQuiz && q.correctAnswer.trim()
            ? { grading: { pointValue: 10, correctAnswers: { answers: [{ value: q.correctAnswer }] } } }
            : {}),
          choiceQuestion: { type: "RADIO", options: opts.length > 0 ? opts : [{ value: "Option 1" }] },
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

  const requests: any[] = [];
  if (isQuiz) {
    requests.push({ updateSettings: { settings: { quizSettings: { isQuiz: true } }, updateMask: "quizSettings" } });
  }
  requests.push(...items);

  if (requests.length > 0) {
    await forms.forms.batchUpdate({ formId, requestBody: { requests } });
  }

  return formId;
}

// ─── Selective / download bundle generators ──────────────────────────────────

type FileChoice = "slides" | "doc" | "quiz";

export async function generateBundleSelective(
  lesson: Lesson,
  files: FileChoice[],
  accessToken: string,
  templateId?: string
): Promise<{ folderUrl: string }> {
  const folder = await createFolder(
    `Lesson Bundle — ${lesson.title}: ${lesson.subtitle}`,
    accessToken
  );
  const folderId = folder.id!;

  const tasks: Promise<string>[] = [];
  if (files.includes("slides")) tasks.push(buildSlideDeck(lesson, accessToken, templateId));
  if (files.includes("doc"))    tasks.push(buildPosterDoc(lesson, accessToken));
  if (files.includes("quiz"))   tasks.push(buildQuiz(lesson, accessToken));

  const fileIds = await Promise.all(tasks);
  await Promise.all(fileIds.map(id => moveFileToFolder(id, folderId, accessToken)));

  return { folderUrl: folder.webViewLink! };
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
  templateId?: string
): Promise<{ filename: string; data: string }[]> {
  const createTasks: { key: string; promise: Promise<string> }[] = [];
  if (files.includes("slides")) createTasks.push({ key: "slides", promise: buildSlideDeck(lesson, accessToken, templateId) });
  if (files.includes("doc"))    createTasks.push({ key: "doc",    promise: buildPosterDoc(lesson, accessToken) });

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
    `Lesson Bundle — ${lesson.title}: ${lesson.subtitle}`,
    accessToken
  );
  const folderId = folder.id!;

  const [deckId, docId, formId] = await Promise.all([
    buildSlideDeck(lesson, accessToken),
    buildPosterDoc(lesson, accessToken),
    buildQuiz(lesson, accessToken),
  ]);

  await Promise.all([
    moveFileToFolder(deckId, folderId, accessToken),
    moveFileToFolder(docId, folderId, accessToken),
    moveFileToFolder(formId, folderId, accessToken),
  ]);

  return { folderUrl: folder.webViewLink!, slideCount: 0 };
}
