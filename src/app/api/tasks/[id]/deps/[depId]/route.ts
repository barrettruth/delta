import { NextResponse } from "next/server";
import { removeDependency } from "@/core/dag";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

type Params = { params: Promise<{ id: string; depId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { id, depId } = await params;
  removeDependency(db, Number(id), Number(depId));
  return NextResponse.json({ ok: true });
}
