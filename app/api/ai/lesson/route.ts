import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userSettings } from "@/lib/userSettings";
import { fillLesson } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const apiKey = await userSettings.getAnthropicKey(session.user.email);
    if (!apiKey) {
      return NextResponse.json({ error: "No Anthropic API key configured. Add your key in Settings." }, { status: 402 });
    }

    const lesson = await req.json();
    const result = await fillLesson(apiKey, lesson);
    return NextResponse.json(result);
  } catch (err: any) {
    // Surface Anthropic billing/auth errors clearly
    if (err.status === 401) return NextResponse.json({ error: "Invalid Anthropic API key." }, { status: 402 });
    if (err.status === 402) return NextResponse.json({ error: "Anthropic credits exhausted. Top up your account at console.anthropic.com." }, { status: 402 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
