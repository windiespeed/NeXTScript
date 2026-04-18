import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { conceptStore } from "@/lib/conceptStore";
import { DEFAULT_JS_CONCEPTS } from "@/types/concept";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const existing = await conceptStore.getAll(session.user.email);
    if (existing.length > 0) {
      return NextResponse.json({ error: "You already have concepts. Delete them first to re-seed." }, { status: 400 });
    }
    const concepts = await conceptStore.createMany(DEFAULT_JS_CONCEPTS, session.user.email);
    return NextResponse.json(concepts, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
