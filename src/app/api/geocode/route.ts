import { NextResponse } from "next/server";
import { getIntegrationConfig } from "@/core/integration-config";
import { db } from "@/db";
import type { LocationResult } from "@/hooks/use-location-search";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

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

function mapboxResults(data: { features?: MapboxFeature[] }): LocationResult[] {
  const features: MapboxFeature[] = data.features ?? [];
  return features.map((f) => ({
    name: f.properties.name ?? "",
    displayName: f.properties.full_address ?? "",
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  }));
}

function photonResults(data: { features?: PhotonFeature[] }): LocationResult[] {
  const features: PhotonFeature[] = data.features ?? [];
  return features.map((f) => {
    const { name, city, state, country } = f.properties;
    const displayName = [name, city, state, country].filter(Boolean).join(", ");
    return {
      name: name ?? "",
      displayName,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    };
  });
}

function googleResults(data: { results?: GoogleResult[] }): LocationResult[] {
  const results: GoogleResult[] = data.results ?? [];
  return results.map((r) => {
    const nameComponent = r.address_components.find(
      (c) =>
        c.types.includes("point_of_interest") ||
        c.types.includes("establishment"),
    );
    return {
      name: nameComponent?.long_name ?? r.formatted_address.split(",")[0],
      displayName: r.formatted_address,
      lat: r.geometry.location.lat,
      lon: r.geometry.location.lng,
    };
  });
}

type Provider = "google_maps" | "mapbox" | "photon";

function resolveProvider(userId: number): {
  provider: Provider;
  key: string | null;
} {
  const gm = getIntegrationConfig(db, userId, "google_maps");
  if (gm?.tokens?.api_key)
    return { provider: "google_maps", key: gm.tokens.api_key as string };

  const mb = getIntegrationConfig(db, userId, "mapbox");
  if (mb?.tokens?.api_key)
    return { provider: "mapbox", key: mb.tokens.api_key as string };

  const envMapbox = process.env.MAPBOX_ACCESS_TOKEN;
  if (envMapbox) return { provider: "mapbox", key: envMapbox };

  return { provider: "photon", key: null };
}

function buildUrl(provider: Provider, key: string | null, q: string): string {
  const encoded = encodeURIComponent(q);
  switch (provider) {
    case "google_maps":
      return `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${key}`;
    case "mapbox":
      return `https://api.mapbox.com/search/geocode/v6/forward?q=${encoded}&access_token=${key}&limit=10`;
    case "photon":
      return `https://photon.komoot.io/api?q=${encoded}&limit=10`;
  }
}

function parseResults(
  provider: Provider,
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

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.length < 3) {
    return NextResponse.json(
      { error: "Query must be at least 3 characters" },
      { status: 400 },
    );
  }

  const { provider, key } = resolveProvider(user.id);
  const url = buildUrl(provider, key, q);

  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json(
      { error: "Geocoding request failed" },
      { status: 502 },
    );
  }

  const data = await res.json();
  const results = parseResults(provider, data);

  return NextResponse.json(results);
}
