import { NextResponse } from "next/server";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import {
  isTaskMutationError,
  removeDependencyForUser,
} from "@/server/task-mutations";

type Params = { params: Promise<{ id: string; depId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id, depId } = await params;
  try {
    removeDependencyForUser(db, user.id, Number(id), Number(depId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isTaskMutationError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
