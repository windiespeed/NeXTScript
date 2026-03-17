import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userSettings } from "@/lib/userSettings";

export const dynamic = "force-dynamic";

const MAX_BYTES = 600_000; // ~450 KB base64 → ~340 KB image — well within Firestore 1 MB doc limit

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { avatarUrl } = await req.json();
    if (typeof avatarUrl !== "string" || !avatarUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image data." }, { status: 400 });
    }
    if (avatarUrl.length > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large. Please use a smaller photo." }, { status: 400 });
    }

    await userSettings.save(session.user.email, { avatarUrl });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    await userSettings.save(session.user.email, { avatarUrl: undefined });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
