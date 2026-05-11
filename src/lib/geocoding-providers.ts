import type {
  GeocodingApiKeyProvider,
  GeocodingProvider,
} from "@/core/provider-registry";
import {
  GEOCODING_API_KEY_PROVIDERS as REGISTRY_GEOCODING_API_KEY_PROVIDERS,
  GEOCODING_PROVIDERS as REGISTRY_GEOCODING_PROVIDERS,
  STORED_GEOCODING_PROVIDER_PRIORITY,
} from "@/core/provider-registry";

export {
  GEOCODING_TOKEN_FIELD,
  type GeocodingApiKeyProvider,
  type GeocodingProvider,
  geocodingProviderLabel,
  geocodingProvidersToClear,
  geocodingTokens,
  isGeocodingApiKeyProvider,
  isGeocodingProvider,
  readGeocodingApiKey,
} from "@/core/provider-registry";

export const GEOCODING_PROVIDER_IDS = REGISTRY_GEOCODING_PROVIDERS.map(
  (provider) => provider.id,
);

export const GEOCODING_PROVIDER_CONFIG = Object.fromEntries(
  REGISTRY_GEOCODING_PROVIDERS.map((provider) => [
    provider.id,
    {
      label: provider.label,
      requiresApiKey: provider.requiresApiKey,
    },
  ]),
) as Record<GeocodingProvider, { label: string; requiresApiKey: boolean }>;

export const GEOCODING_PROVIDERS = REGISTRY_GEOCODING_PROVIDERS.map(
  (provider) => ({
    id: provider.id,
    label: provider.label,
    requiresApiKey: provider.requiresApiKey,
  }),
);

export const GEOCODING_API_KEY_PROVIDERS =
  REGISTRY_GEOCODING_API_KEY_PROVIDERS.map((provider) => provider.id);

export const GEOCODING_STORED_PROVIDER_PRIORITY =
  STORED_GEOCODING_PROVIDER_PRIORITY.map(
    (provider) => provider.id,
  ) as readonly GeocodingApiKeyProvider[];
