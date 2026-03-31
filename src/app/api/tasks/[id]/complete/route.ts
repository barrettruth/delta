import { NextResponse } from "next/server";
import { completeTask, getTask } from "@/core/task";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const taskId = Number(id);
  const existing = getTask(db, taskId);
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  try {
    const result = completeTask(db, user.id, taskId);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error && e.message.includes("not found")) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }
}
