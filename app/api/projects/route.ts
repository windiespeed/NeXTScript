import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAccessibleProjects } from "@/lib/access";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const projects = await getAccessibleProjects(session.user.email);
  return NextResponse.json(projects);
}
