import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { classStore } from "@/lib/classStore";
import type { ClassInput } from "@/types/class";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const classes = await classStore.getAll(session.user.email);
    return NextResponse.json(classes);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const body: ClassInput = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ error: "Class name is required." }, { status: 400 });
    const cls = await classStore.create(body, session.user.email);
    return NextResponse.json(cls, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
