import { NextResponse } from "next/server";
import { db } from "@/db";
import { completeTaskForUser } from "@/server/task-mutations";
import {
  getTaskRouteUser,
  parseTaskRouteId,
  type TaskRouteParams,
  taskMutationErrorResponse,
} from "../../route-adapters";

export async function POST(request: Request, { params }: TaskRouteParams) {
  const auth = await getTaskRouteUser(request);
  if (!auth.ok) return auth.response;
  const user = auth.value;

  const taskId = await parseTaskRouteId(params);

  try {
    const result = completeTaskForUser(db, user.id, taskId);
    return NextResponse.json(result);
  } catch (e) {
    const response = taskMutationErrorResponse(e);
    if (response) return response;
    throw e;
  }
}
