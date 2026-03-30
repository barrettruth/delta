import { NextResponse } from "next/server";
import {
  deleteIntegrationConfig,
  getIntegrationConfig,
  setIntegrationEnabled,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import { db } from "@/db";
import { getAuthUser, unauthorized } from "@/lib/auth-middleware";
import { NLP_MODELS, type NlpProvider } from "@/lib/nlp-models";

const NLP_PROVIDERS: NlpProvider[] = ["anthropic", "openai"];

function isNlpProvider(p: string): p is NlpProvider {
  return NLP_PROVIDERS.includes(p as NlpProvider);
}

function nlpProviderKey(provider: NlpProvider): string {
  return `nlp_${provider}`;
}

function otherProvider(provider: NlpProvider): NlpProvider {
  return provider === "anthropic" ? "openai" : "anthropic";
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const result: Record<string, unknown> = { activeProvider: null };

  for (const p of NLP_PROVIDERS) {
    const key = nlpProviderKey(p);
    const config = getIntegrationConfig(db, user.id, key);
    const configured = !!config;
    const model = config?.metadata?.model as string | null;
    result[`${p}Configured`] = configured;
    result[`${p}Model`] = model ?? NLP_MODELS[p][0].id;
    if (config?.enabled === 1) {
      result.activeProvider = p;
    }
  }

  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const { provider, apiKey, model } = body as {
    provider: string;
    apiKey?: string;
    model?: string;
  };

  if (!provider || !isNlpProvider(provider)) {
    return NextResponse.json(
      { error: "Invalid provider. Must be 'anthropic' or 'openai'." },
      { status: 400 },
    );
  }

  if (model) {
    const validModels = NLP_MODELS[provider].map((m) => m.id);
    if (!validModels.includes(model as (typeof validModels)[number])) {
      return NextResponse.json(
        { error: "Invalid model for provider." },
        { status: 400 },
      );
    }
  }

  const key = nlpProviderKey(provider);
  const existing = getIntegrationConfig(db, user.id, key);

  const tokens = apiKey
    ? { apiKey }
    : existing
      ? existing.tokens
      : { apiKey: "" };

  const metadata = {
    ...(existing?.metadata ?? {}),
    model: model ?? existing?.metadata?.model ?? NLP_MODELS[provider][0].id,
  };

  upsertIntegrationConfig(db, user.id, key, tokens, metadata);

  setIntegrationEnabled(db, user.id, key, 1);

  const other = otherProvider(provider);
  const otherKey = nlpProviderKey(other);
  const otherConfig = getIntegrationConfig(db, user.id, otherKey);
  if (otherConfig) {
    setIntegrationEnabled(db, user.id, otherKey, 0);
  }

  return NextResponse.json({ ok: true, provider, model: metadata.model });
}

export async function PATCH(request: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const { provider, model } = body as {
    provider: string;
    model?: string;
  };

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

  if (model) {
    const validModels = NLP_MODELS[provider].map((m) => m.id);
    if (!validModels.includes(model as (typeof validModels)[number])) {
      return NextResponse.json(
        { error: "Invalid model for provider." },
        { status: 400 },
      );
    }
    const metadata = { ...(existing.metadata ?? {}), model };
    upsertIntegrationConfig(db, user.id, key, existing.tokens, metadata);
  }

  setIntegrationEnabled(db, user.id, key, 1);

  const other = otherProvider(provider);
  const otherKey = nlpProviderKey(other);
  const otherConfig = getIntegrationConfig(db, user.id, otherKey);
  if (otherConfig) {
    setIntegrationEnabled(db, user.id, otherKey, 0);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  for (const p of NLP_PROVIDERS) {
    const key = nlpProviderKey(p);
    deleteIntegrationConfig(db, user.id, key);
  }

  return NextResponse.json({ ok: true });
}
