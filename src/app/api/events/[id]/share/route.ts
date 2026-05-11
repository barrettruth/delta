import { NextResponse } from "next/server";
import { generateShareLink } from "@/core/event-share";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

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
