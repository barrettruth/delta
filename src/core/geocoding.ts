import { getIntegrationConfig } from "@/core/integration-config";
import {
  GEOCODING_STORED_PROVIDER_PRIORITY,
  type GeocodingApiKeyProvider,
  type GeocodingProvider,
  readGeocodingApiKey,
} from "@/lib/geocoding-providers";
import type { Db } from "./types";

export type { GeocodingApiKeyProvider, GeocodingProvider };

export interface LocationResult {
  name: string;
  displayName: string;
  lat: number;
  lon: number;
}

export interface ActiveGeocodingConfig {
  provider: GeocodingProvider;
  apiKey: string | null;
}

interface MapboxFeature {
  properties: {
    name?: string;
    full_address?: string;
  };
  geometry: {
    coordinates: [number, number];
  };
}

interface PhotonFeature {
  properties: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  geometry: {
    coordinates: [number, number];
  };
}

interface GoogleResult {
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  address_components: { long_name: string; types: string[] }[];
}

function readEnvToken(value: string | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

export function getActiveGeocodingConfig(
  db: Db,
  userId: number,
): ActiveGeocodingConfig {
  for (const provider of GEOCODING_STORED_PROVIDER_PRIORITY) {
    const config = getIntegrationConfig(db, userId, provider);
    if (!config || config.enabled !== 1) continue;

    const apiKey = readGeocodingApiKey(config.tokens);
    if (apiKey) return { provider, apiKey };
  }

  const explicitPhoton = getIntegrationConfig(db, userId, "photon");
  if (explicitPhoton?.enabled === 1) {
    return { provider: "photon", apiKey: null };
  }

  const envMapbox = readEnvToken(process.env.MAPBOX_ACCESS_TOKEN);
  if (envMapbox) return { provider: "mapbox", apiKey: envMapbox };

  return { provider: "photon", apiKey: null };
}

export function buildGeocodingUrl(
  provider: GeocodingProvider,
  apiKey: string | null,
  query: string,
): string {
  const encodedQuery = encodeURIComponent(query);
  const encodedKey = apiKey ? encodeURIComponent(apiKey) : null;

  switch (provider) {
    case "google_maps":
      if (!encodedKey) throw new Error("google maps requires an api key");
      return `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&key=${encodedKey}`;
    case "mapbox":
      if (!encodedKey) throw new Error("mapbox requires an api key");
      return `https://api.mapbox.com/search/geocode/v6/forward?q=${encodedQuery}&access_token=${encodedKey}&limit=10`;
    case "photon":
      return `https://photon.komoot.io/api?q=${encodedQuery}&limit=10`;
  }
}

export function parseGeocodingResults(
  provider: GeocodingProvider,
  data: Record<string, unknown>,
): LocationResult[] {
  switch (provider) {
    case "google_maps":
      return googleResults(data as { results?: GoogleResult[] });
    case "mapbox":
      return mapboxResults(data as { features?: MapboxFeature[] });
    case "photon":
      return photonResults(data as { features?: PhotonFeature[] });
  }
}

export async function testGeocodingApiKey(
  provider: GeocodingApiKeyProvider,
  apiKey: string,
): Promise<string | null> {
  const res = await fetch(buildGeocodingUrl(provider, apiKey, "test"));

  if (provider === "google_maps") {
    if (!res.ok) return `unexpected error (${res.status})`;

    const body = (await res.json()) as { status?: string };
    if (body.status === "REQUEST_DENIED") return "invalid api key";
    return null;
  }

  if (res.ok) return null;
  if (res.status === 401 || res.status === 403) return "invalid api key";
  if (res.status === 429) return "rate limited — try again shortly";
  return `unexpected error (${res.status})`;
}

function mapboxResults(data: { features?: MapboxFeature[] }): LocationResult[] {
  const features = data.features ?? [];
  return features.map((feature) => ({
    name: feature.properties.name ?? "",
    displayName: feature.properties.full_address ?? "",
    lat: feature.geometry.coordinates[1],
    lon: feature.geometry.coordinates[0],
  }));
}

function photonResults(data: { features?: PhotonFeature[] }): LocationResult[] {
  const features = data.features ?? [];
  return features.map((feature) => {
    const { name, city, state, country } = feature.properties;
    const displayName = [name, city, state, country].filter(Boolean).join(", ");
    return {
      name: name ?? "",
      displayName,
      lat: feature.geometry.coordinates[1],
      lon: feature.geometry.coordinates[0],
    };
  });
}

function googleResults(data: { results?: GoogleResult[] }): LocationResult[] {
  const results = data.results ?? [];
  return results.map((result) => {
    const nameComponent = result.address_components.find(
      (component) =>
        component.types.includes("point_of_interest") ||
        component.types.includes("establishment"),
    );
    return {
      name:
        nameComponent?.long_name ??
        result.formatted_address.split(",")[0] ??
        "",
      displayName: result.formatted_address,
      lat: result.geometry.location.lat,
      lon: result.geometry.location.lng,
    };
  });
}
