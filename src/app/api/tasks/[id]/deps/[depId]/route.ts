import { NextResponse } from "next/server";
import { db } from "@/db";
import { removeDependencyForUser } from "@/server/task-mutations";
import {
  type DependencyRouteParams,
  getTaskRouteUser,
  parseDependencyRouteIds,
  taskMutationErrorResponse,
} from "../../../route-adapters";

export async function DELETE(
  request: Request,
  { params }: DependencyRouteParams,
) {
  const auth = await getTaskRouteUser(request);
  if (!auth.ok) return auth.response;
  const user = auth.value;

  const { taskId, dependsOnId } = await parseDependencyRouteIds(params);
  try {
    removeDependencyForUser(db, user.id, taskId, dependsOnId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const response = taskMutationErrorResponse(e);
    if (response) return response;
    throw e;
  }
}
