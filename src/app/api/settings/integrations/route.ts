import { NextResponse } from "next/server";
import {
  listIntegrationConfigs,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import {
  getSettingsIntegrationProviderDefinition,
  readProviderApiKey,
} from "@/core/provider-registry";
import { db } from "@/db";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";

export async function GET(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  const configs = listIntegrationConfigs(db, user.id);
  return NextResponse.json(configs);
}

export async function POST(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
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

  const providerDefinition = getSettingsIntegrationProviderDefinition(provider);
  if (!providerDefinition) {
    return NextResponse.json({ error: "invalid provider" }, { status: 400 });
  }

  if (
    providerDefinition.tokenField &&
    !readProviderApiKey(providerDefinition, tokens)
  ) {
    return NextResponse.json({ error: "api key is required" }, { status: 400 });
  }

  const config = upsertIntegrationConfig(
    db,
    user.id,
    providerDefinition.integrationProviderId,
    tokens,
    metadata,
  );

  const { tokens: _, ...safe } = config;
  return NextResponse.json(safe, { status: 201 });
}
