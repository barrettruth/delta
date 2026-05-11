export const NLP_PROVIDERS = ["anthropic", "openai"] as const;

export type NlpProvider = (typeof NLP_PROVIDERS)[number];

export const NLP_MODEL: Record<NlpProvider, string> = {
  anthropic: "claude-haiku-4-5-latest",
  openai: "gpt-4o-mini",
};

export const NLP_TOKEN_FIELD = "api_key";

export function isNlpProvider(provider: string): provider is NlpProvider {
  return NLP_PROVIDERS.includes(provider as NlpProvider);
}

export function nlpProviderKey(provider: NlpProvider): `nlp_${NlpProvider}` {
  return `nlp_${provider}`;
}

export function nlpTokens(
  apiKey: string,
): Record<typeof NLP_TOKEN_FIELD, string> {
  return { [NLP_TOKEN_FIELD]: apiKey };
}

export function readNlpApiKey(tokens: Record<string, unknown>): string | null {
  const value = tokens[NLP_TOKEN_FIELD];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function nlpModel(
  provider: NlpProvider,
  metadata?: Record<string, unknown> | null,
): string {
  const model = metadata?.model;
  return typeof model === "string" && model.trim()
    ? model
    : NLP_MODEL[provider];
}
