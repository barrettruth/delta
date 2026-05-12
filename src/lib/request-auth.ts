import type { SafeUser } from "@/core/auth";
import { validateApiKey } from "@/core/auth";
import { db } from "@/db";
import { getLocalOwner } from "@/lib/local-owner";

export type ApiKeyRequestAuthResult =
  | { kind: "authorized"; user: SafeUser }
  | { kind: "invalid" }
  | { kind: "missing" };

export function getRequestApiKey(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const bearer =
    authorization?.toLowerCase().startsWith("bearer ") === true
      ? authorization.slice("bearer ".length).trim()
      : null;
  const apiKey = request.headers.get("x-api-key") ?? bearer;
  return apiKey || null;
}

export function authenticateApiKeyRequest(
  request: Request,
): ApiKeyRequestAuthResult {
  const apiKey = getRequestApiKey(request);
  if (!apiKey) {
    return { kind: "missing" };
  }

  const user = validateApiKey(db, apiKey);
  return user ? { kind: "authorized", user } : { kind: "invalid" };
}

export function getApiKeyUserOrLocalOwnerFromRequest(
  request: Request,
): SafeUser | null {
  const auth = authenticateApiKeyRequest(request);
  if (auth.kind === "authorized") {
    return auth.user;
  }
  if (auth.kind === "invalid") {
    return null;
  }
  return getLocalOwner();
}
