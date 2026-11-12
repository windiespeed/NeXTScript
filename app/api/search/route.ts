import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { courseStore } from "@/lib/courseStore";
import { serverError } from "@/lib/apiErrors";
import { searchAll } from "@/lib/search";
import type { Lesson } from "@/types/lesson";

export const dynamic = "force-dynamic";

/** GET /api/search?q=... — lessons and courses the signed-in user can open. */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const email = session.user.email;

    const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 200);
    if (!q.trim()) return NextResponse.json({ query: "", courses: [], lessons: [] });

    // Courses the user owns or collaborates on, plus every lesson in them (including ones a
    // collaborator wrote) and the user's own lessons that aren't in any of those courses.
    const courses = await courseStore.getAll(email);
    const [own, ...perCourse] = await Promise.all([
      store.getAll(email),
      ...courses.map(c => store.getAllByCourse(c.id)),
    ]);
    const lessons = new Map<string, Lesson>();
    for (const l of [...own, ...perCourse.flat()]) lessons.set(l.id, l);

    return NextResponse.json(searchAll(q, courses, [...lessons.values()]));
  } catch (err) {
    return serverError(err);
  }
}
