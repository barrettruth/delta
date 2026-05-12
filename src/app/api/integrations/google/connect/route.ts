import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildGoogleAuthorizationUrl,
  googleRedirectUri,
} from "@/core/google/oauth";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";

export async function GET(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 300,
  });

  const authorizationUrl = buildGoogleAuthorizationUrl(
    state,
    googleRedirectUri(request),
  );
  return NextResponse.redirect(authorizationUrl);
}
