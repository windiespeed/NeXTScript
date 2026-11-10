import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readBody, userSettingsPatchSchema } from "@/lib/validation";
import { userSettings } from "@/lib/userSettings";
import { FieldValue } from "firebase-admin/firestore";
import type { UserSettings } from "@/lib/userSettings";
import { serverError } from "@/lib/apiErrors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const s = await userSettings.get(session.user.email);
    return NextResponse.json({
      hasKey: !!s.anthropicKey,
      maskedKey: s.anthropicKey ? `${s.anthropicKey.slice(0, 12)}…${s.anthropicKey.slice(-4)}` : null,
      hasGeminiKey: !!s.geminiKey,
      preferredAiModel: s.preferredAiModel ?? "auto",
      maskedGeminiKey: s.geminiKey ? `${s.geminiKey.slice(0, 12)}…${s.geminiKey.slice(-4)}` : null,
      avatarUrl: s.avatarUrl ?? null,
      defaultSources: s.defaultSources ?? "",
      folders: s.folders ?? [],
      lessonOrder: s.lessonOrder ?? [],
      industry: s.industry ?? "",
      subject: s.subject ?? "",
      sectionLabels: s.sectionLabels ?? {},
      sections: s.sections ?? [],
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    // Only the keys that were sent are saved. A null clears that field to its empty value.
    const parsed = await readBody(req, userSettingsPatchSchema);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const body = parsed.data;
    const update: Partial<UserSettings> = {};
    if (body.anthropicKey !== undefined) update.anthropicKey = body.anthropicKey;
    if (body.geminiKey !== undefined) update.geminiKey = body.geminiKey;
    if (body.defaultSources !== undefined) update.defaultSources = body.defaultSources ?? "";
    if (body.folders !== undefined) update.folders = body.folders ?? [];
    if (body.lessonOrder !== undefined) update.lessonOrder = body.lessonOrder ?? [];
    if (body.industry !== undefined) update.industry = body.industry ?? "";
    if (body.subject !== undefined) update.subject = body.subject ?? "";
    if (body.sectionLabels !== undefined) update.sectionLabels = body.sectionLabels ?? {};
    if (body.sections !== undefined) update.sections = body.sections ?? [];
    if (body.preferredAiModel !== undefined) update.preferredAiModel = body.preferredAiModel ?? "auto";

    await userSettings.save(session.user.email, update);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const field = searchParams.get("key") === "gemini" ? "geminiKey" : "anthropicKey";
    await userSettings.save(session.user.email, { [field]: FieldValue.delete() });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
