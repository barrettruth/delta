import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildAuthorizationUrl,
  getEnabledProviders,
  type OAuthProvider,
} from "@/core/oauth";
import { getAuthUser } from "@/lib/auth-middleware";

const OAUTH_REDIRECT_BASE =
  process.env.OAUTH_REDIRECT_BASE_URL ?? "http://localhost:3000";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const enabled = getEnabledProviders();

  if (!enabled.includes(provider as OAuthProvider)) {
    return NextResponse.json(
      { error: "Unknown or disabled provider" },
      { status: 400 },
    );
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

  const url = buildAuthorizationUrl(
    provider as OAuthProvider,
    state,
    redirectUri,
  );
  return NextResponse.redirect(url);
}
