export const PROVIDER_CATEGORY = {
  calendar: "calendar",
} as const;

export const PROVIDER_SCOPE = {
  geocoding: "geocoding",
  nlpRecurrence: "nlp_recurrence",
} as const;

export const PROVIDER_TOKEN_FIELD = {
  apiKey: "api_key",
} as const;

export const PROVIDER_METADATA_FIELD = {
  model: "model",
} as const;

export const GEOCODING_PROVIDERS = [
  {
    id: "photon",
    label: "photon",
    category: PROVIDER_CATEGORY.calendar,
    scope: PROVIDER_SCOPE.geocoding,
    integrationProviderId: "photon",
    tokenField: null,
    envTokenName: null,
    requiresApiKey: false,
    testable: false,
  },
  {
    id: "mapbox",
    label: "mapbox",
    category: PROVIDER_CATEGORY.calendar,
    scope: PROVIDER_SCOPE.geocoding,
    integrationProviderId: "mapbox",
    tokenField: PROVIDER_TOKEN_FIELD.apiKey,
    envTokenName: "MAPBOX_ACCESS_TOKEN",
    requiresApiKey: true,
    testable: true,
  },
  {
    id: "google_maps",
    label: "google maps",
    category: PROVIDER_CATEGORY.calendar,
    scope: PROVIDER_SCOPE.geocoding,
    integrationProviderId: "google_maps",
    tokenField: PROVIDER_TOKEN_FIELD.apiKey,
    envTokenName: null,
    requiresApiKey: true,
    testable: true,
  },
] as const;

export const DEFAULT_GEOCODING_PROVIDER = GEOCODING_PROVIDERS[0];
export const GEOCODING_ENV_PROVIDER = GEOCODING_PROVIDERS[1];
export const GEOCODING_API_KEY_PROVIDERS = [
  GEOCODING_PROVIDERS[1],
  GEOCODING_PROVIDERS[2],
] as const;
export const STORED_GEOCODING_PROVIDER_PRIORITY = [
  GEOCODING_PROVIDERS[2],
  GEOCODING_PROVIDERS[1],
] as const;
export const GEOCODING_TOKEN_FIELD = PROVIDER_TOKEN_FIELD.apiKey;

export type GeocodingProviderDefinition = (typeof GEOCODING_PROVIDERS)[number];
export type GeocodingApiKeyProviderDefinition =
  (typeof GEOCODING_API_KEY_PROVIDERS)[number];
export type StoredGeocodingProviderDefinition =
  (typeof STORED_GEOCODING_PROVIDER_PRIORITY)[number];
export type GeocodingProviderId = GeocodingProviderDefinition["id"];
export type GeocodingProvider = GeocodingProviderId;
export type GeocodingApiKeyProvider = GeocodingApiKeyProviderDefinition["id"];

export const BUILTIN_NLP_PROVIDER = {
  id: "builtin",
  label: "built-in",
  category: PROVIDER_CATEGORY.calendar,
  scope: PROVIDER_SCOPE.nlpRecurrence,
  integrationProviderId: null,
  tokenField: null,
  metadataModelField: null,
  defaultModel: null,
  testable: false,
} as const;

export const NLP_RECURRENCE_PROVIDERS = [
  {
    id: "anthropic",
    label: "anthropic",
    category: PROVIDER_CATEGORY.calendar,
    scope: PROVIDER_SCOPE.nlpRecurrence,
    integrationProviderId: "nlp_anthropic",
    tokenField: PROVIDER_TOKEN_FIELD.apiKey,
    metadataModelField: PROVIDER_METADATA_FIELD.model,
    defaultModel: "claude-haiku-4-5-latest",
    testable: true,
  },
  {
    id: "openai",
    label: "openai",
    category: PROVIDER_CATEGORY.calendar,
    scope: PROVIDER_SCOPE.nlpRecurrence,
    integrationProviderId: "nlp_openai",
    tokenField: PROVIDER_TOKEN_FIELD.apiKey,
    metadataModelField: PROVIDER_METADATA_FIELD.model,
    defaultModel: "gpt-4o-mini",
    testable: true,
  },
] as const;

export const NLP_PROVIDERS = ["anthropic", "openai"] as const;
export const NLP_SETTINGS_PROVIDERS = [
  BUILTIN_NLP_PROVIDER,
  ...NLP_RECURRENCE_PROVIDERS,
] as const;
export const NLP_MODEL = {
  anthropic: "claude-haiku-4-5-latest",
  openai: "gpt-4o-mini",
} as const;

export const TESTABLE_SETTINGS_PROVIDERS = [
  ...NLP_RECURRENCE_PROVIDERS,
  ...STORED_GEOCODING_PROVIDER_PRIORITY,
] as const;
export const SETTINGS_INTEGRATION_PROVIDERS = [
  ...GEOCODING_PROVIDERS,
  ...NLP_RECURRENCE_PROVIDERS,
] as const;

export type NlpProviderDefinition = (typeof NLP_RECURRENCE_PROVIDERS)[number];
export type NlpProviderId = NlpProviderDefinition["id"];
export type NlpSettingsProviderId =
  (typeof NLP_SETTINGS_PROVIDERS)[number]["id"];
export type TestableSettingsProviderDefinition =
  (typeof TESTABLE_SETTINGS_PROVIDERS)[number];
export type TestableSettingsProviderId =
  TestableSettingsProviderDefinition["id"];
export type SettingsIntegrationProviderDefinition =
  (typeof SETTINGS_INTEGRATION_PROVIDERS)[number];
export type SettingsIntegrationProviderId = NonNullable<
  SettingsIntegrationProviderDefinition["integrationProviderId"]
>;

export function getNlpProviderDefinition(
  provider: string,
): NlpProviderDefinition | null {
  return (
    NLP_RECURRENCE_PROVIDERS.find((definition) => definition.id === provider) ??
    null
  );
}

export function isNlpProvider(provider: string): provider is NlpProviderId {
  return getNlpProviderDefinition(provider) !== null;
}

export function getGeocodingProviderDefinition(
  provider: string,
): GeocodingProviderDefinition | null {
  return (
    GEOCODING_PROVIDERS.find((definition) => definition.id === provider) ?? null
  );
}

export function isGeocodingProvider(
  provider: string,
): provider is GeocodingProviderId {
  return getGeocodingProviderDefinition(provider) !== null;
}

export function isGeocodingApiKeyProvider(
  provider: string,
): provider is GeocodingApiKeyProvider {
  return getGeocodingProviderDefinition(provider)?.requiresApiKey === true;
}

export function getTestableSettingsProviderDefinition(
  provider: string,
): TestableSettingsProviderDefinition | null {
  return (
    TESTABLE_SETTINGS_PROVIDERS.find(
      (definition) => definition.id === provider,
    ) ?? null
  );
}

export function getSettingsIntegrationProviderDefinition(
  integrationProviderId: string,
): SettingsIntegrationProviderDefinition | null {
  return (
    SETTINGS_INTEGRATION_PROVIDERS.find(
      (definition) =>
        definition.integrationProviderId === integrationProviderId,
    ) ?? null
  );
}

export function getOtherNlpProviderDefinitions(
  provider: NlpProviderId,
): NlpProviderDefinition[] {
  return NLP_RECURRENCE_PROVIDERS.filter(
    (definition) => definition.id !== provider,
  );
}

export function geocodingProviderLabel(provider: GeocodingProviderId): string {
  return getGeocodingProviderDefinition(provider)?.label ?? provider;
}

export function geocodingTokens(
  apiKey: string,
): Record<typeof GEOCODING_TOKEN_FIELD, string> {
  return { [GEOCODING_TOKEN_FIELD]: apiKey };
}

export function geocodingProvidersToClear(
  selectedProvider: GeocodingProviderId,
): GeocodingProviderId[] {
  const providers: GeocodingProviderId[] = GEOCODING_API_KEY_PROVIDERS.filter(
    (provider) => provider.id !== selectedProvider,
  ).map((provider) => provider.id);
  if (selectedProvider !== DEFAULT_GEOCODING_PROVIDER.id) {
    providers.push(DEFAULT_GEOCODING_PROVIDER.id);
  }
  return providers;
}

export function readGeocodingApiKey(
  tokens: Record<string, unknown>,
): string | null {
  const value = tokens[GEOCODING_TOKEN_FIELD];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function nlpProviderKey(
  provider: NlpProviderId,
): `nlp_${NlpProviderId}` {
  return getNlpProviderDefinition(provider)
    ?.integrationProviderId as `nlp_${NlpProviderId}`;
}

export function nlpTokens(apiKey: string): Record<"api_key", string> {
  return { [PROVIDER_TOKEN_FIELD.apiKey]: apiKey };
}

export function readProviderApiKey(
  provider: { tokenField: string | null },
  tokens: Record<string, unknown>,
): string | null {
  if (!provider.tokenField) return null;
  const value = tokens[provider.tokenField];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readNlpApiKey(tokens: Record<string, unknown>): string | null {
  return readProviderApiKey(NLP_RECURRENCE_PROVIDERS[0], tokens);
}

export function nlpModel(
  provider: NlpProviderId,
  metadata?: Record<string, unknown> | null,
): string {
  const definition = getNlpProviderDefinition(provider);
  const model = definition?.metadataModelField
    ? metadata?.[definition.metadataModelField]
    : null;
  return typeof model === "string" && model.trim()
    ? model.trim()
    : (definition?.defaultModel ?? NLP_MODEL[provider]);
}

export function nlpMetadata(
  provider: NlpProviderId,
): Record<typeof PROVIDER_METADATA_FIELD.model, string> {
  return { [PROVIDER_METADATA_FIELD.model]: nlpModel(provider) };
}

export function formatNlpProviderList(): string {
  return NLP_PROVIDERS.map((provider) => `'${provider}'`).join(" or ");
}
