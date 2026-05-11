import { NextResponse } from "next/server";
import { db } from "@/db";
import { validateUpdateTask } from "@/lib/validation";
import { deleteTaskForUser, updateTaskForUser } from "@/server/task-mutations";
import {
  findOwnedTaskOrResponse,
  getTaskRouteUser,
  parseTaskRouteId,
  type TaskRouteParams,
  taskMutationErrorResponse,
  validationErrorResponse,
} from "../route-adapters";

export async function GET(request: Request, { params }: TaskRouteParams) {
  const auth = await getTaskRouteUser(request);
  if (!auth.ok) return auth.response;
  const user = auth.value;

  const taskId = await parseTaskRouteId(params);
  const task = findOwnedTaskOrResponse(db, user.id, taskId);
  if (!task.ok) return task.response;

  return NextResponse.json(task.value);
}

export async function PATCH(request: Request, { params }: TaskRouteParams) {
  const auth = await getTaskRouteUser(request);
  if (!auth.ok) return auth.response;
  const user = auth.value;

  const taskId = await parseTaskRouteId(params);

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");

  const body = await request.json();
  const { instanceDate, ...updateFields } = body;
  const result = validateUpdateTask(updateFields);
  if (!result.success || !result.data) {
    return validationErrorResponse(result.errors);
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

export async function DELETE(request: Request, { params }: TaskRouteParams) {
  const auth = await getTaskRouteUser(request);
  if (!auth.ok) return auth.response;
  const user = auth.value;

  const taskId = await parseTaskRouteId(params);

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
