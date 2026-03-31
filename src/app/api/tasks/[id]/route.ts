import { NextResponse } from "next/server";
import {
  deleteAllInstances,
  deleteThisAndFuture,
  deleteThisInstance,
  editAllInstances,
  editThisAndFuture,
  editThisInstance,
} from "@/core/recurrence-editing";
import { completeTask, deleteTask, getTask, updateTask } from "@/core/task";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import { validateUpdateTask } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

function requireOwnership<T extends { userId: number }>(
  task: T | undefined,
  userId: number,
): T | null {
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
  const taskId = Number(id);
  const existing = requireOwnership(getTask(db, taskId), user.id);
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") as "this" | "future" | "all" | null;

  const body = await request.json();
  const { instanceDate, ...updateFields } = body;
  const result = validateUpdateTask(updateFields);
  if (!result.success || !result.data) {
    return NextResponse.json(
      { error: "Validation failed", details: result.errors },
      { status: 400 },
    );
  }

  const validated = result.data;

  try {
    if (scope && existing.recurrence) {
      if (scope === "this") {
        if (!instanceDate) {
          return NextResponse.json(
            { error: "instanceDate is required when scope is 'this'" },
            { status: 400 },
          );
        }
        const task = editThisInstance(
          db,
          user.id,
          taskId,
          instanceDate,
          validated,
        );
        return NextResponse.json(task);
      }
      if (scope === "future") {
        if (!instanceDate) {
          return NextResponse.json(
            { error: "instanceDate is required when scope is 'future'" },
            { status: 400 },
          );
        }
        const task = editThisAndFuture(
          db,
          user.id,
          taskId,
          instanceDate,
          validated,
        );
        return NextResponse.json(task);
      }
      if (scope === "all") {
        const task = editAllInstances(db, user.id, taskId, validated);
        return NextResponse.json(task);
      }
    }

    if (validated.status === "done") {
      const { task } = completeTask(db, user.id, taskId);
      return NextResponse.json(task);
    }

    const task = updateTask(db, taskId, validated);
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
  const taskId = Number(id);
  const existing = requireOwnership(getTask(db, taskId), user.id);
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") as "this" | "future" | "all" | null;

  try {
    if (scope && existing.recurrence) {
      if (scope === "this") {
        const instanceDate = searchParams.get("instanceDate");
        if (!instanceDate) {
          return NextResponse.json(
            { error: "instanceDate is required when scope is 'this'" },
            { status: 400 },
          );
        }
        deleteThisInstance(db, user.id, taskId, instanceDate);
        return NextResponse.json({ success: true });
      }
      if (scope === "future") {
        const instanceDate = searchParams.get("instanceDate");
        if (!instanceDate) {
          return NextResponse.json(
            { error: "instanceDate is required when scope is 'future'" },
            { status: 400 },
          );
        }
        deleteThisAndFuture(db, user.id, taskId, instanceDate);
        return NextResponse.json({ success: true });
      }
      if (scope === "all") {
        deleteAllInstances(db, taskId);
        return NextResponse.json({ success: true });
      }
    }

    const task = deleteTask(db, taskId);
    return NextResponse.json(task);
  } catch (e) {
    if (e instanceof Error && e.message.includes("not found")) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }
}
