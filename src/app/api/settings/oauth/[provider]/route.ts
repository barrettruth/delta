import { NextResponse } from "next/server";
import {
  deleteOAuthProviderConfig,
  isOAuthProviderConfigured,
  setOAuthProviderConfig,
} from "@/core/system-config";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

type Params = { params: Promise<{ provider: string }> };

const VALID_PROVIDERS = ["github", "google"];

export async function GET(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { provider } = await params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  return NextResponse.json({
    provider,
    configured: isOAuthProviderConfigured(db, provider),
  });
}

export async function PUT(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { provider } = await params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const body = await request.json();
  const { clientId, clientSecret } = body;

  if (
    !clientId ||
    !clientSecret ||
    typeof clientId !== "string" ||
    typeof clientSecret !== "string"
  ) {
    return NextResponse.json(
      { error: "clientId and clientSecret are required" },
      { status: 400 },
    );
  }

  setOAuthProviderConfig(db, provider, clientId.trim(), clientSecret.trim());

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { provider } = await params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const deleted = deleteOAuthProviderConfig(db, provider);
  if (!deleted) {
    return NextResponse.json(
      { error: "Provider not configured" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
