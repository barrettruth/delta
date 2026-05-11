import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEOCODING_PROVIDER,
  GEOCODING_ENV_PROVIDER,
  GEOCODING_PROVIDERS,
  geocodingProvidersToClear,
  NLP_SETTINGS_PROVIDERS,
  nlpModel,
  nlpProviderKey,
  nlpTokens,
  PROVIDER_CATEGORY,
  PROVIDER_SCOPE,
  PROVIDER_TOKEN_FIELD,
  readNlpApiKey,
  STORED_GEOCODING_PROVIDER_PRIORITY,
} from "@/core/provider-registry";

describe("provider registry", () => {
  it("defines settings geocoding providers without dropping mapped providers", () => {
    expect(GEOCODING_PROVIDERS.map((provider) => provider.id)).toEqual([
      "photon",
      "mapbox",
      "google_maps",
    ]);
    expect(DEFAULT_GEOCODING_PROVIDER.id).toBe("photon");
    expect(GEOCODING_ENV_PROVIDER.envTokenName).toBe("MAPBOX_ACCESS_TOKEN");
    expect(
      STORED_GEOCODING_PROVIDER_PRIORITY.map((provider) => provider.id),
    ).toEqual(["google_maps", "mapbox"]);
    expect(geocodingProvidersToClear("mapbox")).toEqual([
      "google_maps",
      "photon",
    ]);
  });

  it("defines NLP recurrence providers with current token and metadata fields", () => {
    expect(NLP_SETTINGS_PROVIDERS.map((provider) => provider.id)).toEqual([
      "builtin",
      "anthropic",
      "openai",
    ]);
    expect(nlpProviderKey("anthropic")).toBe("nlp_anthropic");
    expect(nlpTokens("test-secret")).toEqual({
      [PROVIDER_TOKEN_FIELD.apiKey]: "test-secret",
    });
    expect(readNlpApiKey({ api_key: "current-shape" })).toBe("current-shape");
    expect(nlpModel("openai")).toBe("gpt-4o-mini");
  });

  it("keeps provider categories and scopes explicit", () => {
    for (const provider of GEOCODING_PROVIDERS) {
      expect(provider.category).toBe(PROVIDER_CATEGORY.calendar);
      expect(provider.scope).toBe(PROVIDER_SCOPE.geocoding);
    }
  });
});
