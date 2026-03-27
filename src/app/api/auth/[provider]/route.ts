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
  gitlab: {
    authorizeUrl: "https://gitlab.com/oauth/authorize",
    scopes: "read_user",
  },
};

function getEnvVar(provider: OAuthProvider, key: string): string | undefined {
  return process.env[`OAUTH_${provider.toUpperCase()}_${key}`];
}

export async function GET(
  request: Request,
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

  const url = new URL(request.url);
  const invite = url.searchParams.get("invite");

  const state = randomBytes(32).toString("hex");
  const statePayload = JSON.stringify({ state, invite: invite || undefined });
  const cookieStore = await cookies();
  cookieStore.set("oauth_state", statePayload, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const redirectBase =
    process.env.OAUTH_REDIRECT_BASE_URL ?? "http://localhost:3000";
  const redirectUri = `${redirectBase}/api/auth/callback/${provider}`;

  const authorizeUrl = new URL(config.authorizeUrl);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", config.scopes);

  return NextResponse.redirect(authorizeUrl.toString());
}
