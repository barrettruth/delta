import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  consumeInviteCode,
  createSession,
  validateInviteCode,
} from "@/core/auth";
import {
  findOrCreateUserFromOAuth,
  findUserFromOAuth,
  type OAuthProfile,
  type OAuthProvider,
} from "@/core/oauth";
import { db } from "@/db";

interface TokenConfig {
  tokenUrl: string;
  userInfoUrl: string;
  extractProfile: (data: Record<string, unknown>) => OAuthProfile;
  tokenInHeader?: boolean;
}

const providers: Record<OAuthProvider, TokenConfig> = {
  github: {
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    tokenInHeader: true,
    extractProfile: (data) => ({
      username: data.login as string,
      email: (data.email as string) || undefined,
    }),
  },
  gitlab: {
    tokenUrl: "https://gitlab.com/oauth/token",
    userInfoUrl: "https://gitlab.com/api/v4/user",
    tokenInHeader: true,
    extractProfile: (data) => ({
      username: data.username as string,
      email: (data.email as string) || undefined,
    }),
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
    return NextResponse.redirect(
      new URL("/login?error=unknown_provider", request.url),
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/login?error=${errorParam}`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/login?error=missing_params", request.url),
    );
  }

  const cookieStore = await cookies();
  const rawCookie = cookieStore.get("oauth_state")?.value;
  cookieStore.delete("oauth_state");

  let storedState: string | undefined;
  let invite: string | undefined;
  if (rawCookie) {
    try {
      const parsed = JSON.parse(rawCookie);
      storedState = parsed.state;
      invite = parsed.invite;
    } catch {
      storedState = rawCookie;
    }
  }

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_state", request.url),
    );
  }

  const clientId = getEnvVar(provider, "CLIENT_ID");
  const clientSecret = getEnvVar(provider, "CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/login?error=provider_not_configured", request.url),
    );
  }

  const redirectBase =
    process.env.OAUTH_REDIRECT_BASE_URL ?? "http://localhost:3000";
  const redirectUri = `${redirectBase}/api/auth/callback/${provider}`;

  try {
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(
        new URL("/login?error=token_exchange_failed", request.url),
      );
    }

    const tokenData = (await tokenRes.json()) as Record<string, unknown>;
    const accessToken = tokenData.access_token as string;

    if (!accessToken) {
      return NextResponse.redirect(
        new URL("/login?error=no_access_token", request.url),
      );
    }

    const userRes = await fetch(config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(
        new URL("/login?error=user_info_failed", request.url),
      );
    }

    const userData = (await userRes.json()) as Record<string, unknown>;
    const providerAccountId = String(userData.id ?? userData.sub);
    const profile = config.extractProfile(userData);

    const existingUser = findUserFromOAuth(db, provider, providerAccountId);

    if (existingUser) {
      const sessionId = createSession(db, existingUser.id);
      cookieStore.set("session", sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (!invite) {
      return NextResponse.redirect(
        new URL("/login?error=invite_required", request.url),
      );
    }

    if (!validateInviteCode(db, invite)) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_invite", request.url),
      );
    }

    const user = findOrCreateUserFromOAuth(
      db,
      provider,
      providerAccountId,
      profile,
    );

    consumeInviteCode(db, invite, user.id);

    const sessionId = createSession(db, user.id);
    cookieStore.set("session", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.redirect(new URL("/", request.url));
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=oauth_failed", request.url),
    );
  }
}
