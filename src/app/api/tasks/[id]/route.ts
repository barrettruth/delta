import { NextResponse } from "next/server";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import { validateUpdateTask } from "@/lib/validation";
import {
  deleteTaskForUser,
  findOwnedTask,
  isTaskMutationError,
  updateTaskForUser,
} from "@/server/task-mutations";

type Params = { params: Promise<{ id: string }> };

function taskMutationErrorResponse(error: unknown): NextResponse | null {
  if (isTaskMutationError(error)) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  if (error instanceof Error && error.message.includes("not found")) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return null;
}

export async function GET(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const task = findOwnedTask(db, user.id, Number(id));
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

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");

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
    const task = updateTaskForUser(db, user.id, taskId, validated, {
      scope,
      instanceDate,
    });
    return NextResponse.json(task);
  } catch (e) {
    const response = taskMutationErrorResponse(e);
    if (response) return response;
    throw e;
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const taskId = Number(id);

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");

  try {
    const result = deleteTaskForUser(db, user.id, taskId, {
      scope,
      instanceDate: searchParams.get("instanceDate"),
    });
    if (result.kind === "recurrence-scope") {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(result.task);
  } catch (e) {
    const response = taskMutationErrorResponse(e);
    if (response) return response;
    throw e;
  }
}
