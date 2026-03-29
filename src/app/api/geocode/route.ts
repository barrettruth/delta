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

function getMapboxToken(userId: number): string | null {
  const config = getIntegrationConfig(db, userId, "mapbox");
  if (config?.tokens?.api_key) return config.tokens.api_key as string;
  return process.env.MAPBOX_ACCESS_TOKEN ?? null;
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

  const mapboxToken = getMapboxToken(user.id);

  const url = mapboxToken
    ? `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&access_token=${mapboxToken}&limit=10`
    : `https://photon.komoot.io/api?q=${encodeURIComponent(q)}&limit=10`;

  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json(
      { error: "Geocoding request failed" },
      { status: 502 },
    );
  }

  const data = await res.json();
  const results = mapboxToken ? mapboxResults(data) : photonResults(data);

  return NextResponse.json(results);
}
