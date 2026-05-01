import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listGoogleClassrooms } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    if ((session as any).error === "RefreshAccessTokenError") {
      return NextResponse.json({ error: "Your Google session has expired. Please sign out and sign in again." }, { status: 401 });
    }

    const accessToken = (session as any).accessToken as string | undefined;
    if (!accessToken) return NextResponse.json({ error: "No Google access token." }, { status: 401 });

    const classrooms = await listGoogleClassrooms(accessToken);
    return NextResponse.json(classrooms);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
