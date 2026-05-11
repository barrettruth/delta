import { getIntegrationConfig } from "@/core/integration-config";
import {
  NLP_PROVIDERS,
  nlpModel,
  nlpProviderKey,
  readNlpApiKey,
} from "@/lib/nlp-models";
import type { LlmConfig } from "./nlp-recurrence";
import type { Db } from "./types";

export function getActiveNlpConfig(db: Db, userId: number): LlmConfig | null {
  for (const provider of NLP_PROVIDERS) {
    const config = getIntegrationConfig(db, userId, nlpProviderKey(provider));
    if (!config || config.enabled !== 1) continue;

    const apiKey = readNlpApiKey(config.tokens);
    if (!apiKey) continue;

    return {
      provider,
      apiKey,
      model: nlpModel(provider, config.metadata),
    };
  }

  return null;
}
