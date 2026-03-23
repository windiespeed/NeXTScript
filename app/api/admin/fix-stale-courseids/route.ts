/**
 * One-time cleanup: finds all lessons whose courseId points to a course that
 * no longer exists and clears the field via FieldValue.delete().
 *
 * Call once via: POST /api/admin/fix-stale-courseids
 * Safe to call multiple times — subsequent calls are no-ops if already clean.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const userId = session.user.email;
    const db = getDb();

    // Fetch all course IDs that exist for this user
    const coursesSnap = await db.collection("courses").where("userId", "==", userId).get();
    const validCourseIds = new Set(coursesSnap.docs.map(d => d.id));

    // Fetch all lessons for this user that have a courseId set
    const lessonsSnap = await db.collection("lessons")
      .where("userId", "==", userId)
      .get();

    const stale = lessonsSnap.docs.filter(doc => {
      const courseId = doc.data().courseId;
      return courseId && !validCourseIds.has(courseId);
    });

    if (stale.length === 0) {
      return NextResponse.json({ fixed: 0, message: "No stale courseIds found." });
    }

    const batch = db.batch();
    stale.forEach(doc => batch.update(doc.ref, { courseId: FieldValue.delete() }));
    await batch.commit();

    return NextResponse.json({
      fixed: stale.length,
      message: `Cleared stale courseId from ${stale.length} lesson${stale.length !== 1 ? "s" : ""}.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
