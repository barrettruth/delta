import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  getGoogleIntegration,
  googlePublicOrigin,
  googleRedirectUri,
  hasGoogleCalendarScopes,
  hasGoogleTasksScope,
  saveGoogleIntegration,
} from "@/core/google/oauth";
import { GOOGLE_OAUTH_SCOPES } from "@/core/google/types";
import { db } from "@/db";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";
import {
  SETTINGS_RETURN_TO_PARAM,
  safeSettingsReturnTo,
} from "@/lib/settings-navigation";

const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
const GOOGLE_OAUTH_RETURN_TO_COOKIE = "google_oauth_return_to";

function redirectToSettings(
  request: Request,
  status: string,
  returnTo = "/",
): NextResponse {
  const url = new URL("/settings/calendar", googlePublicOrigin(request));
  url.searchParams.set("google", status);
  const safeReturnTo = safeSettingsReturnTo(returnTo);
  if (safeReturnTo !== "/") {
    url.searchParams.set(SETTINGS_RETURN_TO_PARAM, safeReturnTo);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const cookieStore = await cookies();
  const returnTo = safeSettingsReturnTo(
    cookieStore.get(GOOGLE_OAUTH_RETURN_TO_COOKIE)?.value,
  );
  const storedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_OAUTH_RETURN_TO_COOKIE);
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);
  const error = url.searchParams.get("error");
  if (error) return redirectToSettings(request, "denied", returnTo);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state || state !== storedState) {
    return redirectToSettings(request, "invalid-state", returnTo);
  }

  try {
    const existing = getGoogleIntegration(db, user.id);
    const tokens = await exchangeGoogleCode(
      code,
      googleRedirectUri(request),
      existing?.tokens,
    );
    if (!hasGoogleTasksScope(tokens)) {
      return redirectToSettings(request, "missing-tasks-scope", returnTo);
    }
    if (!hasGoogleCalendarScopes(tokens)) {
      return redirectToSettings(request, "missing-calendar-scope", returnTo);
    }
    const profile = await fetchGoogleUserInfo(tokens.accessToken);
    saveGoogleIntegration(db, user.id, tokens, {
      ...(existing?.metadata ?? {}),
      email: profile.email,
      name: profile.name,
      grantedScopes: tokens.scope?.split(" ") ?? [...GOOGLE_OAUTH_SCOPES],
      connectedAt: existing?.metadata.connectedAt ?? new Date().toISOString(),
      lastError: undefined,
    });

    return redirectToSettings(request, "connected", returnTo);
  } catch {
    return redirectToSettings(request, "failed", returnTo);
  }
}
