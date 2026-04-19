/**
 * Migration: merge NeXTBox class data into Drive courses
 *
 * For each class doc:
 *   - Find its linked course (course.moduleId === class.id)
 *   - Copy joinCode, studentIds, language, progressMode,
 *     solutionRevealAttempts, assignedConcepts, teacherId onto the course
 *   - If no linked course exists, create a bare course from the class name
 *
 * Then update all concepts and student_progress docs:
 *   classId → courseId
 *
 * Run (dry-run first):
 *   npx ts-node --project tsconfig.json scripts/migrate-classes-to-courses.ts --dry-run
 *
 * Run (live):
 *   npx ts-node --project tsconfig.json scripts/migrate-classes-to-courses.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env.local relative to the script location
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ── Firebase init ────────────────────────────────────────────────────────────
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ?.replace(/^["']|["']$/g, "")
        .replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

// ── Helpers ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes("--dry-run");

function log(msg: string) { console.log(msg); }
function warn(msg: string) { console.warn("⚠️  " + msg); }
function action(msg: string) { console.log((DRY_RUN ? "[DRY] " : "[LIVE] ") + msg); }

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log(`\n=== migrate-classes-to-courses (${DRY_RUN ? "DRY RUN" : "LIVE"}) ===\n`);

  // 1. Load all classes
  const classesSnap = await db.collection("classes").get();
  const classes = classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  log(`Found ${classes.length} class(es)`);

  // 2. Load all courses (to find moduleId links)
  const coursesSnap = await db.collection("courses").get();
  const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  log(`Found ${courses.length} course(s)`);

  // Build a map: classId → linked courseId
  const classIdToCourseId: Record<string, string> = {};

  for (const cls of classes) {
    const linked = courses.find((c: any) => c.moduleId === cls.id);

    if (linked) {
      classIdToCourseId[cls.id] = linked.id;
      action(`Class "${cls.name}" (${cls.id}) → Course "${linked.title}" (${linked.id})`);

      const patch: Record<string, any> = {
        joinCode:                cls.joinCode,
        studentIds:              cls.studentIds ?? [],
        language:                cls.language ?? "javascript",
        progressMode:            cls.progressMode ?? "locked",
        solutionRevealAttempts:  cls.solutionRevealAttempts ?? null,
        assignedConcepts:        cls.assignedConcepts ?? [],
        teacherId:               cls.teacherId,
        // Remove the now-redundant moduleId link
        moduleId:                FieldValue.delete(),
        updatedAt:               new Date().toISOString(),
      };

      if (!DRY_RUN) {
        await db.collection("courses").doc(linked.id).update(patch);
      } else {
        log(`  Would patch course with: ${JSON.stringify({ ...patch, moduleId: "<delete>" }, null, 2)}`);
      }

    } else {
      // No linked course — create a bare one
      warn(`Class "${cls.name}" (${cls.id}) has no linked course — creating one`);

      const now = new Date().toISOString();
      const newCourseData: Record<string, any> = {
        userId:                  cls.teacherId,
        teacherId:               cls.teacherId,
        title:                   cls.name,
        description:             "",
        gradeLevel:              "",
        term:                    "",
        settings: {
          defaultSources: "",
          defaultTemplateUrl: "",
          industry: "",
          subject: "",
          studentLevel: "",
          sectionLabels: {
            lessonOverview: "Lesson Overview",
            learningTargets: "Learning Targets",
            vocabulary: "Vocabulary",
            warmUp: "Opening Activity",
            guidedLab: "Guided Activity",
            selfPaced: "Independent Activity",
            submissionChecklist: "Requirements Checklist",
            checkpoint: "Common Problems / FAQ",
            industryBestPractices: "Best Practices",
            devJournalPrompt: "Reflection Journal",
            rubric: "Assessment / Rubric",
          },
        },
        lessonIds:               [],
        joinCode:                cls.joinCode,
        studentIds:              cls.studentIds ?? [],
        language:                cls.language ?? "javascript",
        progressMode:            cls.progressMode ?? "locked",
        solutionRevealAttempts:  cls.solutionRevealAttempts ?? null,
        assignedConcepts:        cls.assignedConcepts ?? [],
        createdAt:               cls.createdAt ?? now,
        updatedAt:               now,
      };

      if (!DRY_RUN) {
        const ref = await db.collection("courses").add(newCourseData);
        classIdToCourseId[cls.id] = ref.id;
        action(`  Created new course (${ref.id}) for class "${cls.name}"`);
      } else {
        log(`  Would create course: ${JSON.stringify(newCourseData, null, 2)}`);
        classIdToCourseId[cls.id] = `<new-course-for-${cls.id}>`;
      }
    }
  }

  log(`\n--- classId → courseId map ---`);
  Object.entries(classIdToCourseId).forEach(([k, v]) => log(`  ${k} → ${v}`));

  // 3. Migrate concepts: classId → courseId
  log(`\n--- Migrating concepts ---`);
  const conceptsSnap = await db.collection("concepts").get();
  log(`Found ${conceptsSnap.size} concept(s)`);

  let conceptsUpdated = 0;
  let conceptsSkipped = 0;

  // Orphan concepts (no classId) are assigned to this fallback course
  const ORPHAN_COURSE_ID = "34aa4ca3-65dc-478d-b291-078a82cf3cc4"; // Test Course 1

  for (const doc of conceptsSnap.docs) {
    const data = doc.data();
    const classId = data.classId;

    let courseId: string;

    if (!classId) {
      courseId = ORPHAN_COURSE_ID;
      action(`Concept "${data.label}" (${doc.id}): no classId → assigning to orphan fallback course ${ORPHAN_COURSE_ID}`);
    } else {
      const mapped = classIdToCourseId[classId];
      if (!mapped) {
        warn(`Concept ${doc.id} has classId "${classId}" with no matching class — skipping`);
        conceptsSkipped++;
        continue;
      }
      courseId = mapped;
      action(`Concept "${data.label}" (${doc.id}): classId → courseId ${courseId}`);
    }

    if (!DRY_RUN) {
      await db.collection("concepts").doc(doc.id).update({
        courseId,
        classId: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      });
    }
    conceptsUpdated++;
  }

  log(`  Updated: ${conceptsUpdated}, Skipped: ${conceptsSkipped}`);

  // 4. Migrate student_progress: classId → courseId
  log(`\n--- Migrating student_progress ---`);
  const progressSnap = await db.collection("student_progress").get();
  log(`Found ${progressSnap.size} progress record(s)`);

  let progressUpdated = 0;
  let progressSkipped = 0;

  // Batch writes for efficiency (Firestore limit: 500 per batch)
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of progressSnap.docs) {
    const data = doc.data();
    const classId = data.classId;

    if (!classId) { progressSkipped++; continue; }

    const courseId = classIdToCourseId[classId];
    if (!courseId) {
      warn(`Progress ${doc.id} has classId "${classId}" with no matching class — skipping`);
      progressSkipped++;
      continue;
    }

    if (!DRY_RUN) {
      batch.update(doc.ref, {
        courseId,
        classId: FieldValue.delete(),
      });
      batchCount++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    } else {
      action(`Progress ${doc.id} (student: ${data.studentId}): classId → courseId ${courseId}`);
    }
    progressUpdated++;
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  log(`  Updated: ${progressUpdated}, Skipped: ${progressSkipped}`);

  // 5. Summary
  log(`\n=== Migration ${DRY_RUN ? "dry run" : ""} complete ===`);
  log(`  Classes processed:        ${classes.length}`);
  log(`  Concepts updated:         ${conceptsUpdated}`);
  log(`  Progress records updated: ${progressUpdated}`);

  if (DRY_RUN) {
    log(`\nRun without --dry-run to apply changes.`);
  } else {
    log(`\nNext steps:`);
    log(`  1. Verify data in Firestore console`);
    log(`  2. Update NeXTBox app to use courseId instead of classId`);
    log(`  3. Delete the classes collection once confirmed`);
  }
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
