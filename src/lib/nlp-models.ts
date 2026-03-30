export const NLP_MODELS = {
  anthropic: [
    { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
    { id: "claude-sonnet-4-6-20260320", label: "Sonnet 4.6" },
    { id: "claude-opus-4-6-20260320", label: "Opus 4.6" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-5", label: "GPT-5" },
  ],
} as const;

export type NlpProvider = keyof typeof NLP_MODELS;
export type NlpModelId<P extends NlpProvider> =
  (typeof NLP_MODELS)[P][number]["id"];
