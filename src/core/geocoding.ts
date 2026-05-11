export const GEOCODING_PROVIDER = {
  id: "photon",
  label: "photon",
} as const;

export type GeocodingProviderId = typeof GEOCODING_PROVIDER.id;

export interface LocationResult {
  name: string;
  displayName: string;
  lat: number;
  lon: number;
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

export function buildGeocodingUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://photon.komoot.io/api?q=${encoded}&limit=10`;
}

export function parseGeocodingResults(data: {
  features?: PhotonFeature[];
}): LocationResult[] {
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
