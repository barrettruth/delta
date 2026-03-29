import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildAuthorizationUrl,
  getEnabledProviders,
  type OAuthProvider,
} from "@/core/oauth";
import { db } from "@/db";
import { getAuthUser } from "@/lib/auth-middleware";

const OAUTH_REDIRECT_BASE =
  process.env.OAUTH_REDIRECT_BASE_URL ?? "http://localhost:3000";

const SCOPE_MAP: Record<string, string> = {
  "calendar.events": "https://www.googleapis.com/auth/calendar.events",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const enabled = getEnabledProviders(db);

  if (!enabled.includes(provider as OAuthProvider)) {
    return NextResponse.json(
      { error: "Unknown or disabled provider" },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const scopeParam = url.searchParams.get("scope");
  const extraScopes: string[] = [];

  if (scopeParam) {
    for (const s of scopeParam.split(",")) {
      const mapped = SCOPE_MAP[s.trim()];
      if (mapped) {
        extraScopes.push(mapped);
      }
    }
  }

  const state = randomBytes(32).toString("hex");
  const redirectUri = `${OAUTH_REDIRECT_BASE}/api/auth/callback/${provider}`;

  const cookieStore = await cookies();

  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });

  const user = await getAuthUser();
  if (user) {
    cookieStore.set("oauth_link", "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    });
  }

  if (extraScopes.length > 0) {
    cookieStore.set("oauth_extra_scopes", extraScopes.join(" "), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    });
  }

  const authUrl = buildAuthorizationUrl(
    db,
    provider as OAuthProvider,
    state,
    redirectUri,
    extraScopes.length > 0 ? extraScopes : undefined,
  );
  return NextResponse.redirect(authUrl);
}
