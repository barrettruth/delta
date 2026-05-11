import { NextResponse } from "next/server";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import {
  completeTaskForUser,
  isTaskMutationError,
} from "@/server/task-mutations";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const taskId = Number(id);

  try {
    const result = completeTaskForUser(db, user.id, taskId);
    return NextResponse.json(result);
  } catch (e) {
    if (isTaskMutationError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof Error && e.message.includes("not found")) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }
}
