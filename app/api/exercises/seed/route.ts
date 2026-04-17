import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exerciseStore } from "@/lib/exerciseStore";
import { SEED_EXERCISES } from "@/data/seed-exercises";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    if (!force) {
      const alreadySeeded = await exerciseStore.hasSeeded(session.user.email);
      if (alreadySeeded) return NextResponse.json({ message: "Already seeded.", seeded: 0 });
    }

    await exerciseStore.createMany(SEED_EXERCISES, session.user.email);
    return NextResponse.json({ message: "Seeded successfully.", seeded: SEED_EXERCISES.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
