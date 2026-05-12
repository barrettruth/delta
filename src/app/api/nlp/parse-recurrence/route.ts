import { NextResponse } from "next/server";
import { getActiveNlpConfig } from "@/core/nlp-config";
import { parseRecurrence, parseRecurrenceLocal } from "@/core/nlp-recurrence";
import { db } from "@/db";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";

const MAX_TEXT_LENGTH = 200;

export async function POST(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
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

  const llmConfig = getActiveNlpConfig(db, user.id);
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
