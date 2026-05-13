import {
  getIntegrationConfig,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import type { Db } from "@/core/types";
import {
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_PROVIDER,
  GOOGLE_TASKS_SCOPE,
  type GoogleIntegrationMetadata,
  type GoogleOAuthTokens,
} from "./types";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

interface GoogleUserInfo {
  email?: string;
  name?: string;
}

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

function credential(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function getGoogleOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId =
    credential("GOOGLE_CLIENT_ID") ??
    credential("GOOGLE_OAUTH_CLIENT_ID") ??
    credential("OAUTH_GOOGLE_CLIENT_ID");
  const clientSecret =
    credential("GOOGLE_CLIENT_SECRET") ??
    credential("GOOGLE_OAUTH_CLIENT_SECRET") ??
    credential("OAUTH_GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function googlePublicOrigin(request: Request): string {
  const origin =
    credential("DELTA_PUBLIC_ORIGIN") ??
    credential("NEXT_PUBLIC_DELTA_ORIGIN") ??
    new URL(request.url).origin;
  return origin.replace(/\/$/, "");
}

export function googleRedirectUri(request: Request): string {
  return `${googlePublicOrigin(request)}/api/integrations/google/callback`;
}

export function buildGoogleAuthorizationUrl(
  state: string,
  redirectUri: string,
): string {
  const credentials = getGoogleOAuthCredentials();
  if (!credentials) {
    throw new GoogleAuthError("Google OAuth is not configured", 500);
  }

  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

function expiresAt(expiresIn: number | undefined): string | undefined {
  if (!expiresIn) return undefined;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function normalizeTokens(
  response: GoogleTokenResponse,
  existing?: GoogleOAuthTokens | null,
): GoogleOAuthTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? existing?.refreshToken,
    expiresAt: expiresAt(response.expires_in),
    scope: response.scope ?? existing?.scope,
    tokenType: response.token_type ?? existing?.tokenType,
  };
}

async function parseGoogleTokenResponse(response: Response) {
  if (!response.ok) {
    throw new GoogleAuthError(
      `Google token exchange failed (${response.status})`,
    );
  }
  return (await response.json()) as GoogleTokenResponse;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  existing?: GoogleOAuthTokens | null,
): Promise<GoogleOAuthTokens> {
  const credentials = getGoogleOAuthCredentials();
  if (!credentials) {
    throw new GoogleAuthError("Google OAuth is not configured", 500);
  }

  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  return normalizeTokens(await parseGoogleTokenResponse(response), existing);
}

export async function refreshGoogleTokens(
  tokens: GoogleOAuthTokens,
): Promise<GoogleOAuthTokens> {
  if (!tokens.refreshToken) {
    throw new GoogleAuthError("Google authorization needs to be reconnected");
  }

  const credentials = getGoogleOAuthCredentials();
  if (!credentials) {
    throw new GoogleAuthError("Google OAuth is not configured", 500);
  }

  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  return normalizeTokens(await parseGoogleTokenResponse(response), tokens);
}

function tokensFromConfig(value: Record<string, unknown>): GoogleOAuthTokens {
  return {
    accessToken: String(value.accessToken ?? ""),
    refreshToken:
      typeof value.refreshToken === "string" ? value.refreshToken : undefined,
    expiresAt:
      typeof value.expiresAt === "string" ? value.expiresAt : undefined,
    scope: typeof value.scope === "string" ? value.scope : undefined,
    tokenType:
      typeof value.tokenType === "string" ? value.tokenType : undefined,
  };
}

function shouldRefresh(tokens: GoogleOAuthTokens): boolean {
  if (!tokens.accessToken) return true;
  if (!tokens.expiresAt) return false;
  return new Date(tokens.expiresAt).getTime() <= Date.now() + 60_000;
}

export function getGoogleIntegration(
  db: Db,
  userId: number,
): {
  tokens: GoogleOAuthTokens;
  metadata: GoogleIntegrationMetadata;
  enabled: number;
} | null {
  const config = getIntegrationConfig(db, userId, GOOGLE_PROVIDER);
  if (!config) return null;
  return {
    tokens: tokensFromConfig(config.tokens),
    metadata: (config.metadata ?? {}) as GoogleIntegrationMetadata,
    enabled: config.enabled,
  };
}

export function saveGoogleIntegration(
  db: Db,
  userId: number,
  tokens: GoogleOAuthTokens,
  metadata: GoogleIntegrationMetadata,
): void {
  upsertIntegrationConfig(
    db,
    userId,
    GOOGLE_PROVIDER,
    {
      accessToken: tokens.accessToken,
      ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
      ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {}),
      ...(tokens.scope ? { scope: tokens.scope } : {}),
      ...(tokens.tokenType ? { tokenType: tokens.tokenType } : {}),
    },
    metadata,
  );
}

export function hasGoogleTasksScope(tokens: GoogleOAuthTokens): boolean {
  if (!tokens.scope) return false;
  return tokens.scope.split(" ").includes(GOOGLE_TASKS_SCOPE);
}

export async function getGoogleAccessToken(
  db: Db,
  userId: number,
): Promise<string> {
  const config = getGoogleIntegration(db, userId);
  if (!config || config.enabled !== 1) {
    throw new GoogleAuthError("Google account is not connected");
  }

  if (!shouldRefresh(config.tokens)) return config.tokens.accessToken;

  const refreshed = await refreshGoogleTokens(config.tokens);
  saveGoogleIntegration(db, userId, refreshed, {
    ...config.metadata,
    lastRefreshAt: new Date().toISOString(),
  });
  return refreshed.accessToken;
}

export async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return {};
  return (await response.json()) as GoogleUserInfo;
}

export function googleIntegrationSummary(
  db: Db,
  userId: number,
): {
  connected: boolean;
  email: string | null;
  name: string | null;
  tasksLastPulledAt: string | null;
  tasksLastError: string | null;
} {
  const config = getGoogleIntegration(db, userId);
  const metadata = config?.metadata;
  return {
    connected: Boolean(config && config.enabled === 1),
    email: typeof metadata?.email === "string" ? metadata.email : null,
    name: typeof metadata?.name === "string" ? metadata.name : null,
    tasksLastPulledAt:
      typeof metadata?.tasks?.lastPulledAt === "string"
        ? metadata.tasks.lastPulledAt
        : null,
    tasksLastError:
      typeof metadata?.lastError === "string" ? metadata.lastError : null,
  };
}
