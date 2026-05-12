import { NextResponse } from "next/server";
import {
  GeocodingProviderSelectionError,
  selectGeocodingProvider,
} from "@/core/geocoding";
import { db } from "@/db";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";

export async function PUT(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  const body = await request.json();
  const { provider, apiKey } = body as {
    provider: string;
    apiKey?: string | null;
  };

  if (!provider || typeof provider !== "string") {
    return NextResponse.json(
      { error: "provider is required" },
      { status: 400 },
    );
  }

  try {
    const selection = selectGeocodingProvider(db, user.id, {
      provider,
      apiKey,
    });
    return NextResponse.json({ ok: true, ...selection });
  } catch (error) {
    if (error instanceof GeocodingProviderSelectionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
