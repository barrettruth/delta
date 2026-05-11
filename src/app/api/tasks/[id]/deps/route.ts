import { NextResponse } from "next/server";
import { getDependencies } from "@/core/dag";
import { db } from "@/db";
import { addDependencyForUser } from "@/server/task-mutations";
import {
  findOwnedTaskOrResponse,
  getTaskRouteUser,
  parseDependencyRequestBody,
  parseTaskRouteId,
  type TaskRouteParams,
  taskMutationErrorResponse,
  taskRouteError,
} from "../../route-adapters";

export async function GET(request: Request, { params }: TaskRouteParams) {
  const auth = await getTaskRouteUser(request);
  if (!auth.ok) return auth.response;
  const user = auth.value;

  const taskId = await parseTaskRouteId(params);
  const task = findOwnedTaskOrResponse(db, user.id, taskId);
  if (!task.ok) return task.response;

  return NextResponse.json(getDependencies(db, taskId));
}

export async function POST(request: Request, { params }: TaskRouteParams) {
  const auth = await getTaskRouteUser(request);
  if (!auth.ok) return auth.response;
  const user = auth.value;

  const taskId = await parseTaskRouteId(params);
  const dependency = await parseDependencyRequestBody(request);
  if (!dependency.ok) return dependency.response;

  try {
    addDependencyForUser(db, user.id, taskId, dependency.value.dependsOnId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    const response = taskMutationErrorResponse(e);
    if (response) return response;
    if (e instanceof Error) {
      return taskRouteError(e.message, 400);
    }
    throw e;
  }
}
