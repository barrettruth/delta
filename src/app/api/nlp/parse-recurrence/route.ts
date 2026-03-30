import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { decrypt, getEncryptionKey } from "@/core/encryption";
import {
  type LlmConfig,
  parseRecurrence,
  parseRecurrenceLocal,
} from "@/core/nlp-recurrence";
import type { NlpProvider } from "@/core/types";
import { db } from "@/db";
import { integrationConfigs } from "@/db/schema";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

const MAX_TEXT_LENGTH = 200;

function getActiveNlpConfig(userId: number): LlmConfig | null {
  const providers: NlpProvider[] = ["anthropic", "openai"];

  for (const provider of providers) {
    const row = db
      .select()
      .from(integrationConfigs)
      .where(
        and(
          eq(integrationConfigs.userId, userId),
          eq(integrationConfigs.provider, `nlp_${provider}`),
          eq(integrationConfigs.enabled, 1),
        ),
      )
      .get();

    if (row) {
      const key = getEncryptionKey();
      const tokens = JSON.parse(decrypt(row.encryptedTokens, key));
      const metadata = row.metadata ? JSON.parse(row.metadata) : null;

      return {
        provider,
        apiKey: tokens.api_key as string,
        model: metadata?.model as string | undefined,
      };
    }
  }

  return null;
}

export async function POST(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  let body: { text?: string; referenceDate?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json(
      { error: "text field is required" },
      { status: 400 },
    );
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `text must be at most ${MAX_TEXT_LENGTH} characters` },
      { status: 400 },
    );
  }

  const local = parseRecurrenceLocal(text);
  if (local) {
    return NextResponse.json(local);
  }

  const llmConfig = getActiveNlpConfig(user.id);
  if (!llmConfig) {
    return NextResponse.json(
      {
        error:
          "Could not parse locally. Configure an NLP provider (Anthropic or OpenAI) in settings to enable LLM fallback.",
      },
      { status: 422 },
    );
  }

  const result = await parseRecurrence(text, llmConfig, body.referenceDate);
  if (!result) {
    return NextResponse.json(
      { error: "Failed to parse recurrence pattern" },
      { status: 422 },
    );
  }

  return NextResponse.json(result);
}
