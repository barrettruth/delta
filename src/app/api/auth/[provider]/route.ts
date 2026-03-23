import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { OAuthProvider } from "@/core/oauth";

interface ProviderConfig {
  authorizeUrl: string;
  scopes: string;
}

const providers: Record<OAuthProvider, ProviderConfig> = {
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    scopes: "read:user user:email",
  },
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: "openid email profile",
  },
  gitlab: {
    authorizeUrl: "https://gitlab.com/oauth/authorize",
    scopes: "read_user",
  },
};

function getEnvVar(provider: OAuthProvider, key: string): string | undefined {
  return process.env[`OAUTH_${provider.toUpperCase()}_${key}`];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as OAuthProvider;

  const config = providers[provider];
  if (!config) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const clientId = getEnvVar(provider, "CLIENT_ID");
  if (!clientId) {
    return NextResponse.json(
      { error: "Provider not configured" },
      { status: 400 },
    );
  }

  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const redirectBase =
    process.env.OAUTH_REDIRECT_BASE_URL ?? "http://localhost:3000";
  const redirectUri = `${redirectBase}/api/auth/callback/${provider}`;

  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes);

  return NextResponse.redirect(url.toString());
}
