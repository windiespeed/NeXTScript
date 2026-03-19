import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userSettings } from "@/lib/userSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const s = await userSettings.get(session.user.email);
    return NextResponse.json({
      hasKey: !!s.anthropicKey,
      maskedKey: s.anthropicKey ? `${s.anthropicKey.slice(0, 12)}…${s.anthropicKey.slice(-4)}` : null,
      avatarUrl: s.avatarUrl ?? null,
      defaultSources: s.defaultSources ?? "",
      folders: s.folders ?? [],
      defaultTemplateUrl: s.defaultTemplateUrl ?? "",
      lessonOrder: s.lessonOrder ?? [],
      industry: s.industry ?? "",
      subject: s.subject ?? "",
      sectionLabels: s.sectionLabels ?? {},
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const body = await req.json();
    const update: Record<string, string | string[] | undefined> = {};

    if ("anthropicKey" in body) {
      if (typeof body.anthropicKey !== "string" || !body.anthropicKey.trim()) {
        return NextResponse.json({ error: "Invalid key." }, { status: 400 });
      }
      update.anthropicKey = body.anthropicKey.trim();
    }

    if ("defaultSources" in body) {
      update.defaultSources = typeof body.defaultSources === "string" ? body.defaultSources : "";
    }

    if ("folders" in body) {
      update.folders = Array.isArray(body.folders) ? body.folders : [];
    }

    if ("defaultTemplateUrl" in body) {
      update.defaultTemplateUrl = typeof body.defaultTemplateUrl === "string" ? body.defaultTemplateUrl : "";
    }

    if ("lessonOrder" in body) {
      update.lessonOrder = Array.isArray(body.lessonOrder) ? body.lessonOrder : [];
    }

    if ("industry" in body) {
      update.industry = typeof body.industry === "string" ? body.industry : "";
    }

    if ("subject" in body) {
      update.subject = typeof body.subject === "string" ? body.subject : "";
    }

    if ("sectionLabels" in body) {
      update.sectionLabels = typeof body.sectionLabels === "object" ? body.sectionLabels : {};
    }

    await userSettings.save(session.user.email, update);
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
