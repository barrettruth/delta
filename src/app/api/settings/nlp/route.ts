import { NextResponse } from "next/server";
import {
  deleteIntegrationConfig,
  getIntegrationConfig,
  setIntegrationEnabled,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import {
  formatNlpProviderList,
  getNlpProviderDefinition,
  getOtherNlpProviderDefinitions,
  isNlpProvider,
  NLP_PROVIDERS,
  nlpMetadata,
  nlpModel,
  nlpProviderKey,
  nlpTokens,
  readNlpApiKey,
} from "@/core/provider-registry";
import { db } from "@/db";
import { getLocalOwner } from "@/lib/local-owner";

export async function GET() {
  const user = await getLocalOwner();

  const result: Record<string, unknown> = { activeProvider: null };

  for (const p of NLP_PROVIDERS) {
    const key = nlpProviderKey(p);
    const config = getIntegrationConfig(db, user.id, key);
    const configured = !!config && !!readNlpApiKey(config.tokens);
    result[`${p}Configured`] = configured;
    result[`${p}Model`] = nlpModel(p, config?.metadata);
    if (configured && config?.enabled === 1 && !result.activeProvider) {
      result.activeProvider = p;
    }
  }

  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const user = await getLocalOwner();

  const body = await request.json();
  const { provider, apiKey } = body as {
    provider: string;
    apiKey?: string;
  };

  if (!provider || !isNlpProvider(provider)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be ${formatNlpProviderList()}.` },
      { status: 400 },
    );
  }

  const key = nlpProviderKey(provider);
  const existing = getIntegrationConfig(db, user.id, key);
  const trimmedApiKey = typeof apiKey === "string" ? apiKey.trim() : "";
  const existingApiKey = existing ? readNlpApiKey(existing.tokens) : null;

  if (!trimmedApiKey && !existingApiKey) {
    return NextResponse.json({ error: "api key is required" }, { status: 400 });
  }

  const tokens = nlpTokens(trimmedApiKey || existingApiKey || "");

  const metadata = {
    ...nlpMetadata(provider),
    ...(existing?.metadata ?? {}),
  };

  upsertIntegrationConfig(db, user.id, key, tokens, metadata);

  setIntegrationEnabled(db, user.id, key, 1);

  for (const other of getOtherNlpProviderDefinitions(provider)) {
    const otherConfig = getIntegrationConfig(
      db,
      user.id,
      other.integrationProviderId,
    );
    if (otherConfig) {
      setIntegrationEnabled(db, user.id, other.integrationProviderId, 0);
    }
  }

  return NextResponse.json({ ok: true, provider, model: metadata.model });
}

export async function PATCH(request: Request) {
  const user = await getLocalOwner();

  const body = await request.json();
  const { provider } = body as { provider: string };

  if (!provider || !isNlpProvider(provider)) {
    return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  }

  const key = nlpProviderKey(provider);
  const existing = getIntegrationConfig(db, user.id, key);

  if (!existing) {
    return NextResponse.json(
      { error: "Provider not configured." },
      { status: 404 },
    );
  }

  setIntegrationEnabled(db, user.id, key, 1);

  for (const other of getOtherNlpProviderDefinitions(provider)) {
    const otherConfig = getIntegrationConfig(
      db,
      user.id,
      other.integrationProviderId,
    );
    if (otherConfig) {
      setIntegrationEnabled(db, user.id, other.integrationProviderId, 0);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getLocalOwner();

  for (const provider of NLP_PROVIDERS) {
    const definition = getNlpProviderDefinition(provider);
    if (definition) {
      deleteIntegrationConfig(db, user.id, definition.integrationProviderId);
    }
  }

  return NextResponse.json({ ok: true });
}
