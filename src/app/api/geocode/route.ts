import { NextResponse } from "next/server";
import { buildGeocodingUrl, parseGeocodingResults } from "@/core/geocoding";
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

  try {
    const res = await fetch(buildGeocodingUrl(q));
    if (!res.ok) {
      return NextResponse.json(
        { error: "Geocoding request failed" },
        { status: 502 },
      );
    }

    const data = await res.json();
    const results = parseGeocodingResults(data);

    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Geocoding request failed" },
      { status: 502 },
    );
  }
}
