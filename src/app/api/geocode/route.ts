import { NextResponse } from "next/server";
import {
  buildGeocodingUrl,
  getActiveGeocodingConfig,
  parseGeocodingResults,
} from "@/core/geocoding";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

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

  const { provider, apiKey } = getActiveGeocodingConfig(db, user.id);
  const url = buildGeocodingUrl(provider, apiKey, q);

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return NextResponse.json(
      { error: "Geocoding request failed" },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "Geocoding request failed" },
      { status: 502 },
    );
  }

  const data = await res.json();
  const results = parseGeocodingResults(provider, data);

  return NextResponse.json(results);
}
