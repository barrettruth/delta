import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  getGoogleIntegration,
  googleRedirectUri,
  hasGoogleTasksScope,
  saveGoogleIntegration,
} from "@/core/google/oauth";
import { GOOGLE_OAUTH_SCOPES } from "@/core/google/types";
import { db } from "@/db";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";

function redirectToSettings(request: Request, status: string): NextResponse {
  const url = new URL("/settings/calendar", request.url);
  url.searchParams.set("google", status);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) return redirectToSettings(request, "denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (!code || !state || state !== storedState) {
    return redirectToSettings(request, "invalid-state");
  }

  try {
    const existing = getGoogleIntegration(db, user.id);
    const tokens = await exchangeGoogleCode(
      code,
      googleRedirectUri(request),
      existing?.tokens,
    );
    if (!hasGoogleTasksScope(tokens)) {
      return redirectToSettings(request, "missing-tasks-scope");
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

    return redirectToSettings(request, "connected");
  } catch {
    return redirectToSettings(request, "failed");
  }
}
