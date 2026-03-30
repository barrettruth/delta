import { NextResponse } from "next/server";
import {
  deleteIntegrationConfig,
  getIntegrationConfig,
  upsertIntegrationConfig,
} from "@/core/integration-config";
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

export async function PATCH(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { provider } = await params;
  const body = await request.json();
  const { metadata: patch } = body as {
    metadata: Record<string, unknown>;
  };

  if (!patch || typeof patch !== "object") {
    return NextResponse.json(
      { error: "metadata is required and must be an object" },
      { status: 400 },
    );
  }

  const existing = getIntegrationConfig(db, user.id, provider);
  if (!existing) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 },
    );
  }

  const merged = { ...(existing.metadata ?? {}), ...patch };
  const config = upsertIntegrationConfig(
    db,
    user.id,
    provider,
    existing.tokens,
    merged,
  );

  const { tokens: _, ...safe } = config;
  return NextResponse.json(safe);
}
