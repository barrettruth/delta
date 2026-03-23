import { NextResponse } from "next/server";
import { removeDependency } from "@/core/dag";
import { getTask } from "@/core/task";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

type Params = { params: Promise<{ id: string; depId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id, depId } = await params;
  const task = getTask(db, Number(id));
  if (!task || task.userId !== user.id) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  removeDependency(db, Number(id), Number(depId));
  return NextResponse.json({ ok: true });
}
