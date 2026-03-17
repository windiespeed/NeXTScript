import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userSettings } from "@/lib/userSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const key = await userSettings.getAnthropicKey(session.user.email);
    return NextResponse.json({
      hasKey: !!key,
      maskedKey: key ? `${key.slice(0, 12)}…${key.slice(-4)}` : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { anthropicKey } = await req.json();
    if (typeof anthropicKey !== "string" || !anthropicKey.trim()) {
      return NextResponse.json({ error: "Invalid key." }, { status: 400 });
    }

    await userSettings.save(session.user.email, { anthropicKey: anthropicKey.trim() });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    await userSettings.save(session.user.email, { anthropicKey: undefined });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
