import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  consumeInviteToken,
  createSession,
  validateInviteToken,
} from "@/core/auth";
import { upsertIntegrationConfig } from "@/core/integration-config";
import {
  exchangeCodeForToken,
  fetchProviderUser,
  findAccountByProvider,
  findOrCreateUserFromOAuth,
  getEnabledProviders,
  linkAccount,
  type OAuthProvider,
} from "@/core/oauth";
import { getUserTwoFactorMethods } from "@/core/two-factor";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { getAuthUser } from "@/lib/auth-middleware";

const OAUTH_REDIRECT_BASE =
  process.env.OAUTH_REDIRECT_BASE_URL ?? "http://localhost:3000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const enabled = getEnabledProviders(db);

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
  const extraScopes = cookieStore.get("oauth_extra_scopes")?.value;

  cookieStore.delete("oauth_state");
  cookieStore.delete("oauth_link");
  cookieStore.delete("oauth_extra_scopes");

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(
      `${OAUTH_REDIRECT_BASE}/login?error=invalid_state`,
    );
  }

  try {
    const redirectUri = `${OAUTH_REDIRECT_BASE}/api/auth/callback/${provider}`;
    const tokens = await exchangeCodeForToken(
      db,
      provider as OAuthProvider,
      code,
      redirectUri,
    );
    const providerUser = await fetchProviderUser(
      db,
      provider as OAuthProvider,
      tokens.accessToken,
    );

    if (extraScopes && isLinking) {
      const currentUser = await getAuthUser();
      if (currentUser) {
        const tokenExpiresAt = tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
          : undefined;

        db.update(accounts)
          .set({
            accessToken: tokens.accessToken,
            ...(tokens.refreshToken
              ? { refreshToken: tokens.refreshToken }
              : {}),
            ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
          })
          .where(
            and(
              eq(accounts.userId, currentUser.id),
              eq(accounts.provider, provider),
            ),
          )
          .run();

        if (
          extraScopes.includes(
            "https://www.googleapis.com/auth/calendar.events",
          )
        ) {
          upsertIntegrationConfig(db, currentUser.id, "google_calendar", {});
        }

        return NextResponse.redirect(`${OAUTH_REDIRECT_BASE}/calendar`);
      }
    }

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
          providerUser.name,
        );
        return NextResponse.redirect(`${OAUTH_REDIRECT_BASE}/settings`);
      }
    }

    const existing = findAccountByProvider(
      db,
      provider as OAuthProvider,
      providerUser.id,
    );

    const inviteToken = cookieStore.get("invite_token")?.value;

    if (!existing && !inviteToken) {
      return NextResponse.redirect(
        `${OAUTH_REDIRECT_BASE}/login?error=no_invite`,
      );
    }

    if (!existing && inviteToken) {
      const invite = validateInviteToken(db, inviteToken);
      if (!invite) {
        cookieStore.delete("invite_token");
        return NextResponse.redirect(
          `${OAUTH_REDIRECT_BASE}/login?error=invalid_invite`,
        );
      }
    }

    const { user, isNew } = findOrCreateUserFromOAuth(
      db,
      provider as OAuthProvider,
      providerUser,
      tokens,
    );

    if (isNew && inviteToken) {
      consumeInviteToken(db, inviteToken, user.id);
      cookieStore.delete("invite_token");
    }

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

    const shareToken = cookieStore.get("share_token")?.value;
    if (shareToken) {
      try {
        const { acceptShareLink } = await import("@/core/event-share");
        acceptShareLink(db, user.id, shareToken);
      } catch {}
      cookieStore.delete("share_token");
    }

    return NextResponse.redirect(
      shareToken
        ? `${OAUTH_REDIRECT_BASE}/calendar`
        : `${OAUTH_REDIRECT_BASE}/setup-2fa`,
    );
  } catch {
    return NextResponse.redirect(
      `${OAUTH_REDIRECT_BASE}/login?error=oauth_failed`,
    );
  }
}
