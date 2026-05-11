export const GEOCODING_PROVIDER_IDS = [
  "photon",
  "mapbox",
  "google_maps",
] as const;

export type GeocodingProvider = (typeof GEOCODING_PROVIDER_IDS)[number];
export type GeocodingApiKeyProvider = Exclude<GeocodingProvider, "photon">;

export const GEOCODING_TOKEN_FIELD = "api_key";

export const GEOCODING_PROVIDER_CONFIG: Record<
  GeocodingProvider,
  { label: string; requiresApiKey: boolean }
> = {
  photon: { label: "photon", requiresApiKey: false },
  mapbox: { label: "mapbox", requiresApiKey: true },
  google_maps: { label: "google maps", requiresApiKey: true },
};

export const GEOCODING_PROVIDERS = GEOCODING_PROVIDER_IDS.map((id) => ({
  id,
  ...GEOCODING_PROVIDER_CONFIG[id],
}));

export const GEOCODING_API_KEY_PROVIDERS = GEOCODING_PROVIDER_IDS.filter(
  (id): id is GeocodingApiKeyProvider =>
    GEOCODING_PROVIDER_CONFIG[id].requiresApiKey,
);

export const GEOCODING_STORED_PROVIDER_PRIORITY = [
  "google_maps",
  "mapbox",
] as const satisfies readonly GeocodingApiKeyProvider[];

export function isGeocodingProvider(
  provider: string,
): provider is GeocodingProvider {
  return Object.hasOwn(GEOCODING_PROVIDER_CONFIG, provider);
}

export function isGeocodingApiKeyProvider(
  provider: string,
): provider is GeocodingApiKeyProvider {
  return (
    isGeocodingProvider(provider) &&
    GEOCODING_PROVIDER_CONFIG[provider].requiresApiKey
  );
}

export function geocodingProviderLabel(provider: GeocodingProvider): string {
  return GEOCODING_PROVIDER_CONFIG[provider].label;
}

export function geocodingTokens(
  apiKey: string,
): Record<typeof GEOCODING_TOKEN_FIELD, string> {
  return { [GEOCODING_TOKEN_FIELD]: apiKey };
}

export function geocodingProvidersToClear(
  selectedProvider: GeocodingProvider,
): GeocodingProvider[] {
  const providers: GeocodingProvider[] = GEOCODING_API_KEY_PROVIDERS.filter(
    (provider) => provider !== selectedProvider,
  );
  if (selectedProvider !== "photon") providers.push("photon");
  return providers;
}

export function readGeocodingApiKey(
  tokens: Record<string, unknown>,
): string | null {
  const value = tokens[GEOCODING_TOKEN_FIELD];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
