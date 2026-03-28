import { NextResponse } from "next/server";
import {
  listIntegrationConfigs,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const configs = listIntegrationConfigs(db, user.id);
  return NextResponse.json(configs);
}

export async function POST(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const { provider, tokens, metadata } = body as {
    provider: string;
    tokens: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };

  if (!provider || typeof provider !== "string") {
    return NextResponse.json(
      { error: "provider is required" },
      { status: 400 },
    );
  }

  if (!tokens || typeof tokens !== "object") {
    return NextResponse.json(
      { error: "tokens is required and must be an object" },
      { status: 400 },
    );
  }

  const config = upsertIntegrationConfig(
    db,
    user.id,
    provider,
    tokens,
    metadata,
  );

  const { tokens: _, ...safe } = config;
  return NextResponse.json(safe, { status: 201 });
}
