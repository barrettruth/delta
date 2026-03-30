import { RRule } from "rrule";
import { NLP_MODELS } from "@/lib/nlp-models";
import type { NlpProvider, NlpSource } from "./types";

export interface NlpParseResult {
  rrule: string;
  humanText: string;
  source: NlpSource;
}

export interface LlmConfig {
  provider: NlpProvider;
  apiKey: string;
  model?: string;
}

const NORMALIZATION_MAP: [RegExp, string][] = [
  [/^daily$/i, "every day"],
  [/^weekly$/i, "every week"],
  [/^biweekly$/i, "every 2 weeks"],
  [/^bi-weekly$/i, "every 2 weeks"],
  [/^fortnightly$/i, "every 2 weeks"],
  [/^monthly$/i, "every month"],
  [/^bimonthly$/i, "every 2 months"],
  [/^bi-monthly$/i, "every 2 months"],
  [/^yearly$/i, "every year"],
  [/^annually$/i, "every year"],
  [/^quarterly$/i, "every 3 months"],
  [/^weekdays$/i, "every weekday"],
  [/^mwf$/i, "every monday, wednesday, and friday"],
  [/^tth$/i, "every tuesday and thursday"],
  [/^mw$/i, "every monday and wednesday"],
  [/^tr$/i, "every tuesday and thursday"],
  [/^every\s+other\s+(.+)$/i, "every 2 $1"],
];

export function normalizeInput(text: string): string {
  const trimmed = text.trim();

  for (const [pattern, replacement] of NORMALIZATION_MAP) {
    const match = trimmed.match(pattern);
    if (match) {
      if (replacement.includes("$1") && match[1]) {
        return replacement.replace("$1", match[1]);
      }
      return replacement;
    }
  }

  return trimmed;
}

export function parseRecurrenceLocal(text: string): NlpParseResult | null {
  const normalized = normalizeInput(text);

  let opts: Partial<ConstructorParameters<typeof RRule>[0]> | null;
  try {
    opts = RRule.parseText(normalized);
  } catch {
    return null;
  }

  if (!opts || opts.freq === undefined || opts.freq === null) {
    return null;
  }

  const rule = new RRule(opts);
  const rruleStr = rule.toString().replace(/^RRULE:/, "");

  return {
    rrule: rruleStr,
    humanText: rule.toText(),
    source: "local",
  };
}

export function validateRRule(str: string): boolean {
  try {
    RRule.fromString(str.startsWith("RRULE:") ? str : `RRULE:${str}`);
    return true;
  } catch {
    return false;
  }
}

function buildLlmPrompt(text: string, referenceDate?: string): string {
  const refStr = referenceDate
    ? `The current date is ${referenceDate}.`
    : `The current date is ${new Date().toISOString().split("T")[0]}.`;

  return `You are a recurrence rule parser. Convert the following natural language recurrence description into an RFC 5545 RRULE string.

${refStr}

Rules:
- Return ONLY valid JSON: {"rrule": "<RRULE_STRING>", "confidence": <0.0-1.0>}
- The rrule value must NOT include the "RRULE:" prefix
- Use standard RRULE components: FREQ, INTERVAL, BYDAY, BYMONTH, BYMONTHDAY, COUNT, UNTIL
- If the input is ambiguous, use your best interpretation and lower the confidence

Input: "${text}"`;
}

async function callAnthropic(
  prompt: string,
  apiKey: string,
  model: string,
  signal: AbortSignal,
): Promise<{ rrule: string; confidence: number }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in Anthropic response");
  }

  return JSON.parse(jsonMatch[0]);
}

async function callOpenAI(
  prompt: string,
  apiKey: string,
  model: string,
  signal: AbortSignal,
): Promise<{ rrule: string; confidence: number }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 150,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in OpenAI response");
  }

  return JSON.parse(jsonMatch[0]);
}

export async function parseRecurrenceLlm(
  text: string,
  config: LlmConfig,
  referenceDate?: string,
): Promise<NlpParseResult | null> {
  const prompt = buildLlmPrompt(text, referenceDate);
  const defaultModel =
    config.provider === "anthropic"
      ? NLP_MODELS.anthropic[0].id
      : NLP_MODELS.openai[0].id;
  const model = config.model ?? defaultModel;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const result =
      config.provider === "anthropic"
        ? await callAnthropic(prompt, config.apiKey, model, controller.signal)
        : await callOpenAI(prompt, config.apiKey, model, controller.signal);

    if (!result.rrule || !validateRRule(result.rrule)) {
      return null;
    }

    const rule = RRule.fromString(
      result.rrule.startsWith("RRULE:")
        ? result.rrule
        : `RRULE:${result.rrule}`,
    );

    return {
      rrule: result.rrule,
      humanText: rule.toText(),
      source: config.provider,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function parseRecurrence(
  text: string,
  llmConfig?: LlmConfig,
  referenceDate?: string,
): Promise<NlpParseResult | null> {
  const local = parseRecurrenceLocal(text);
  if (local) return local;

  if (llmConfig) {
    return parseRecurrenceLlm(text, llmConfig, referenceDate);
  }

  return null;
}
