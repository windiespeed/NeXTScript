import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { conceptStore } from "@/lib/conceptStore";
import { canAccessConcept } from "@/lib/access";
import { conceptPatchSchema, parsePatch } from "@/lib/validation";
import type { Concept } from "@/types/concept";
import { serverError } from "@/lib/apiErrors";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const existing = await conceptStore.getById(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!(await canAccessConcept(existing, session.user.email))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const parsed = parsePatch(conceptPatchSchema, await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const updated = await conceptStore.update(id, parsed.data as Partial<Concept>);
    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { id } = await params;
    const existing = await conceptStore.getById(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!(await canAccessConcept(existing, session.user.email))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    await conceptStore.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
