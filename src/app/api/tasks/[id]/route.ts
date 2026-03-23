import { NextResponse } from "next/server";
import { completeTask, deleteTask, getTask, updateTask } from "@/core/task";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import { validateUpdateTask } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

function requireOwnership(
  task: { userId: number } | undefined,
  userId: number,
) {
  if (!task || task.userId !== userId) return null;
  return task;
}

export async function GET(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const task = requireOwnership(getTask(db, Number(id)), user.id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const existing = requireOwnership(getTask(db, Number(id)), user.id);
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = validateUpdateTask(body);
  if (!result.success || !result.data) {
    return NextResponse.json(
      { error: "Validation failed", details: result.errors },
      { status: 400 },
    );
  }

  const validated = result.data;

  try {
    if (validated.status === "done") {
      const task = completeTask(db, user.id, Number(id));
      return NextResponse.json(task);
    }

    const task = updateTask(db, Number(id), validated);
    return NextResponse.json(task);
  } catch (e) {
    if (e instanceof Error && e.message.includes("not found")) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const existing = requireOwnership(getTask(db, Number(id)), user.id);
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  try {
    const task = deleteTask(db, Number(id));
    return NextResponse.json(task);
  } catch (e) {
    if (e instanceof Error && e.message.includes("not found")) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }
}
