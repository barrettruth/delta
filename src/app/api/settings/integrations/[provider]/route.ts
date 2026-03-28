import { NextResponse } from "next/server";
import { deleteIntegrationConfig } from "@/core/integration-config";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

type Params = { params: Promise<{ provider: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { provider } = await params;

  const deleted = deleteIntegrationConfig(db, user.id, provider);
  if (!deleted) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
