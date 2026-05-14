import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildGoogleAuthorizationUrl,
  googleRedirectUri,
} from "@/core/google/oauth";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";
import {
  SETTINGS_RETURN_TO_PARAM,
  safeSettingsReturnTo,
} from "@/lib/settings-navigation";

const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
const GOOGLE_OAUTH_RETURN_TO_COOKIE = "google_oauth_return_to";

function cookieOptions(request: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 300,
  };
}

export async function GET(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  const state = randomBytes(32).toString("hex");
  const url = new URL(request.url);
  const returnTo = safeSettingsReturnTo(
    url.searchParams.get(SETTINGS_RETURN_TO_PARAM),
  );
  const cookieStore = await cookies();
  const options = cookieOptions(request);
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, options);
  if (returnTo === "/") {
    cookieStore.delete(GOOGLE_OAUTH_RETURN_TO_COOKIE);
  } else {
    cookieStore.set(GOOGLE_OAUTH_RETURN_TO_COOKIE, returnTo, options);
  }

  const authorizationUrl = buildGoogleAuthorizationUrl(
    state,
    googleRedirectUri(request),
  );
  return NextResponse.redirect(authorizationUrl);
}
