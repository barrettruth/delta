import { NextResponse } from "next/server";
import { testGeocodingApiKey } from "@/core/geocoding";
import {
  getTestableSettingsProviderDefinition,
  type NlpProviderDefinition,
  type TestableSettingsProviderDefinition,
  type TestableSettingsProviderId,
} from "@/core/provider-registry";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";

async function testAnthropic(
  provider: NlpProviderDefinition,
  apiKey: string,
  model?: string,
): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model || provider.defaultModel,
      max_tokens: 1,
      messages: [{ role: "user", content: "." }],
    }),
  });
  if (res.ok) return null;
  if (res.status === 401 || res.status === 403) return "invalid api key";
  if (res.status === 429) return "rate limited — try again shortly";
  return `unexpected error (${res.status})`;
}

async function testOpenai(
  provider: NlpProviderDefinition,
  apiKey: string,
  model?: string,
): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || provider.defaultModel,
      max_tokens: 1,
      messages: [{ role: "user", content: "." }],
    }),
  });
  if (res.ok) return null;
  if (res.status === 401 || res.status === 403) return "invalid api key";
  if (res.status === 429) return "rate limited — try again shortly";
  return `unexpected error (${res.status})`;
}

type ProviderTest = (
  provider: TestableSettingsProviderDefinition,
  apiKey: string,
  model?: string,
) => Promise<string | null>;

const PROVIDER_TESTS: Record<TestableSettingsProviderId, ProviderTest> = {
  anthropic: (provider, apiKey, model) =>
    testAnthropic(provider as NlpProviderDefinition, apiKey, model),
  openai: (provider, apiKey, model) =>
    testOpenai(provider as NlpProviderDefinition, apiKey, model),
  mapbox: (_provider, apiKey) => testGeocodingApiKey("mapbox", apiKey),
  google_maps: (_provider, apiKey) =>
    testGeocodingApiKey("google_maps", apiKey),
};

export async function POST(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const { provider, apiKey, model } = body as {
    provider: string;
    apiKey: string;
    model?: string;
  };

  const providerDefinition = provider
    ? getTestableSettingsProviderDefinition(provider)
    : null;
  if (!providerDefinition) {
    return NextResponse.json(
      { valid: false, error: "invalid provider" },
      { status: 400 },
    );
  }

  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json(
      { valid: false, error: "api key is required" },
      { status: 400 },
    );
  }

  let error: string | null;
  try {
    error = await PROVIDER_TESTS[providerDefinition.id](
      providerDefinition,
      apiKey,
      model,
    );
  } catch {
    return NextResponse.json({ valid: false, error: "connection failed" });
  }

  if (error) {
    return NextResponse.json({ valid: false, error });
  }

  return NextResponse.json({ valid: true });
}
