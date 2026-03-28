import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession } from "@/core/auth";
import {
  exchangeCodeForToken,
  fetchProviderUser,
  findOrCreateUserFromOAuth,
  getEnabledProviders,
  linkAccount,
  type OAuthProvider,
} from "@/core/oauth";
import { getUserTwoFactorMethods } from "@/core/two-factor";
import { db } from "@/db";
import { getAuthUser } from "@/lib/auth-middleware";

const OAUTH_REDIRECT_BASE =
  process.env.OAUTH_REDIRECT_BASE_URL ?? "http://localhost:3000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const enabled = getEnabledProviders();

  if (!enabled.includes(provider as OAuthProvider)) {
    return NextResponse.redirect(
      `${OAUTH_REDIRECT_BASE}/login?error=unknown_provider`,
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${OAUTH_REDIRECT_BASE}/login?error=provider_denied`,
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;
  const isLinking = cookieStore.get("oauth_link")?.value === "1";

  cookieStore.delete("oauth_state");
  cookieStore.delete("oauth_link");

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(
      `${OAUTH_REDIRECT_BASE}/login?error=invalid_state`,
    );
  }

  try {
    const redirectUri = `${OAUTH_REDIRECT_BASE}/api/auth/callback/${provider}`;
    const tokens = await exchangeCodeForToken(
      provider as OAuthProvider,
      code,
      redirectUri,
    );
    const providerUser = await fetchProviderUser(
      provider as OAuthProvider,
      tokens.accessToken,
    );

    if (isLinking) {
      const currentUser = await getAuthUser();
      if (currentUser) {
        linkAccount(
          db,
          currentUser.id,
          provider as OAuthProvider,
          providerUser.id,
          tokens,
          providerUser.email,
        );
        return NextResponse.redirect(`${OAUTH_REDIRECT_BASE}/`);
      }
    }

    const { user } = findOrCreateUserFromOAuth(
      db,
      provider as OAuthProvider,
      providerUser,
      tokens,
    );

    const twoFactorMethods = getUserTwoFactorMethods(db, user.id);

    if (twoFactorMethods.length > 0) {
      cookieStore.set("pending_2fa", String(user.id), {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 300,
      });
      return NextResponse.redirect(`${OAUTH_REDIRECT_BASE}/login/verify-2fa`);
    }

    const sessionId = createSession(db, user.id);
    cookieStore.set("session", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.redirect(`${OAUTH_REDIRECT_BASE}/setup-2fa`);
  } catch {
    return NextResponse.redirect(
      `${OAUTH_REDIRECT_BASE}/login?error=oauth_failed`,
    );
  }
}
