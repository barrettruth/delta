export type NlpProvider = "anthropic" | "openai";

export const NLP_MODEL: Record<NlpProvider, string> = {
  anthropic: "claude-haiku-4-5-latest",
  openai: "gpt-4o-mini",
};
