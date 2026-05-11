import { NextResponse } from "next/server";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";
import type { NlpProvider } from "@/lib/nlp-models";

const VALID_PROVIDERS = new Set<NlpProvider>(["anthropic", "openai"]);

async function testAnthropic(
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
      model: model || "claude-haiku-4-5-20251001",
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
      model: model || "gpt-4o-mini",
      max_tokens: 1,
      messages: [{ role: "user", content: "." }],
    }),
  });
  if (res.ok) return null;
  if (res.status === 401 || res.status === 403) return "invalid api key";
  if (res.status === 429) return "rate limited — try again shortly";
  return `unexpected error (${res.status})`;
}

export async function POST(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const { provider, apiKey, model } = body as {
    provider: string;
    apiKey: string;
    model?: string;
  };

  if (!provider || !VALID_PROVIDERS.has(provider as NlpProvider)) {
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
    switch (provider as NlpProvider) {
      case "anthropic":
        error = await testAnthropic(apiKey, model);
        break;
      case "openai":
        error = await testOpenai(apiKey, model);
        break;
    }
  } catch {
    return NextResponse.json({ valid: false, error: "connection failed" });
  }

  if (error) {
    return NextResponse.json({ valid: false, error });
  }

  return NextResponse.json({ valid: true });
}
