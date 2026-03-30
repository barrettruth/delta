import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateSession } from "@/core/auth";
import { generateShareLink } from "@/core/event-share";
import { db } from "@/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = validateSession(db, sessionId);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const taskId = Number.parseInt(id, 10);
  if (Number.isNaN(taskId))
    return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let instanceDate: string | undefined;
  try {
    const body = await request.json();
    instanceDate = body.instanceDate;
  } catch {
    // no body is fine
  }

  try {
    const token = generateShareLink(db, user.id, taskId, instanceDate);
    const url = new URL(`/event/share/${token}`, request.url);
    return NextResponse.json({ token, url: url.toString() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to create share link" },
      { status: 400 },
    );
  }
}
