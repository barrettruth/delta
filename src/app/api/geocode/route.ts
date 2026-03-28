import { NextResponse } from "next/server";
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

  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Geocoding service not configured" },
      { status: 503 },
    );
  }

  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&access_token=${token}&limit=10`;

  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json(
      { error: "Geocoding request failed" },
      { status: 502 },
    );
  }

  const data = await res.json();
  const features: MapboxFeature[] = data.features ?? [];

  const results: LocationResult[] = features.map((f) => ({
    name: f.properties.name ?? "",
    displayName: f.properties.full_address ?? "",
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  }));

  return NextResponse.json(results);
}
