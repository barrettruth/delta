import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { accounts, users, webauthnCredentials } from "@/db/schema";
import type { Db } from "./types";

export type OAuthProvider = "github" | "google";

export type ProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
};

export type ProviderUser = {
  id: string;
  email: string;
  name?: string;
};

type TokenResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

const ALL_PROVIDERS: OAuthProvider[] = ["github", "google"];

export function getProviderConfig(
  provider: OAuthProvider,
): ProviderConfig | null {
  if (provider === "github") {
    const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
    const clientSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      userInfoUrl: "https://api.github.com/user",
      clientId,
      clientSecret,
      scopes: ["read:user", "user:email"],
    };
  }

  if (provider === "google") {
    const clientId = process.env.OAUTH_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.OAUTH_GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
      clientId,
      clientSecret,
      scopes: ["openid", "email", "profile"],
    };
  }

  return null;
}

export function getEnabledProviders(): OAuthProvider[] {
  return ALL_PROVIDERS.filter((p) => {
    const key = `OAUTH_${p.toUpperCase()}_CLIENT_ID`;
    return !!process.env[key];
  });
}

export function buildAuthorizationUrl(
  provider: OAuthProvider,
  state: string,
  redirectUri: string,
): string {
  const config = getProviderConfig(provider);
  if (!config) throw new Error(`Provider ${provider} is not configured`);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(" "),
    state,
    response_type: "code",
  });

  if (provider === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }

  return `${config.authorizeUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const config = getProviderConfig(provider);
  if (!config) throw new Error(`Provider ${provider} is not configured`);

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  if (provider === "google") {
    body.set("grant_type", "authorization_code");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (provider === "github") {
    headers.Accept = "application/json";
  }

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  const data = await res.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? undefined,
    expiresIn: data.expires_in ?? undefined,
  };
}

export async function fetchProviderUser(
  provider: OAuthProvider,
  accessToken: string,
): Promise<ProviderUser> {
  const config = getProviderConfig(provider);
  if (!config) throw new Error(`Provider ${provider} is not configured`);

  const res = await fetch(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`User info fetch failed: ${res.status}`);
  }

  const data = await res.json();

  if (provider === "github") {
    let email = data.email as string | null;

    if (!email) {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (emailRes.ok) {
        const emails = await emailRes.json();
        const primary = emails.find(
          (e: { primary: boolean; verified: boolean; email: string }) =>
            e.primary && e.verified,
        );
        email = primary?.email ?? emails[0]?.email ?? null;
      }
    }

    return {
      id: String(data.id),
      email: email ?? "",
      name: data.name ?? data.login,
    };
  }

  return {
    id: String(data.id),
    email: data.email ?? "",
    name: data.name,
  };
}

export async function refreshGoogleToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = process.env.OAUTH_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

export function linkAccount(
  db: Db,
  userId: number,
  provider: OAuthProvider,
  providerAccountId: string,
  tokens: { accessToken?: string; refreshToken?: string; expiresIn?: number },
  email?: string,
) {
  const tokenExpiresAt = tokens.expiresIn
    ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
    : undefined;

  return db
    .insert(accounts)
    .values({
      userId,
      provider,
      providerAccountId,
      accessToken: tokens.accessToken ?? null,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokenExpiresAt ?? null,
      email: email ?? null,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();
}

export function findAccountByProvider(
  db: Db,
  provider: OAuthProvider,
  providerAccountId: string,
) {
  return (
    db
      .select()
      .from(accounts)
      .innerJoin(users, eq(accounts.userId, users.id))
      .where(
        and(
          eq(accounts.provider, provider),
          eq(accounts.providerAccountId, providerAccountId),
        ),
      )
      .get() ?? null
  );
}

export function findOrCreateUserFromOAuth(
  db: Db,
  provider: OAuthProvider,
  providerUser: ProviderUser,
  tokens: { accessToken?: string; refreshToken?: string; expiresIn?: number },
): { user: typeof users.$inferSelect; isNew: boolean } {
  const existing = findAccountByProvider(db, provider, providerUser.id);
  if (existing) {
    return { user: existing.users, isNew: false };
  }

  const existingUser = providerUser.email
    ? db
        .select()
        .from(users)
        .where(eq(users.username, providerUser.email))
        .get()
    : undefined;

  if (existingUser) {
    linkAccount(
      db,
      existingUser.id,
      provider,
      providerUser.id,
      tokens,
      providerUser.email,
    );
    return { user: existingUser, isNew: false };
  }

  let username = providerUser.name || providerUser.email || provider;
  const taken = db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (taken) {
    username = `${username}-${randomBytes(4).toString("hex")}`;
  }

  const newUser = db
    .insert(users)
    .values({
      username,
      passwordHash: null,
      apiKey: randomBytes(32).toString("hex"),
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();

  linkAccount(
    db,
    newUser.id,
    provider,
    providerUser.id,
    tokens,
    providerUser.email,
  );

  return { user: newUser, isNew: true };
}

export function getLinkedAccounts(db: Db, userId: number) {
  return db
    .select({
      id: accounts.id,
      provider: accounts.provider,
      providerAccountId: accounts.providerAccountId,
      email: accounts.email,
      createdAt: accounts.createdAt,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .all();
}

export function unlinkAccount(
  db: Db,
  userId: number,
  provider: OAuthProvider,
): { success: boolean; error?: string } {
  const linked = getLinkedAccounts(db, userId);
  const hasPasskeys =
    db
      .select()
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, userId))
      .all().length > 0;

  const otherProviders = linked.filter((a) => a.provider !== provider);
  if (otherProviders.length === 0 && !hasPasskeys) {
    return { success: false, error: "Cannot unlink last auth method" };
  }

  const target = linked.find((a) => a.provider === provider);
  if (!target) {
    return { success: false, error: "Provider not linked" };
  }

  db.delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)))
    .run();

  return { success: true };
}
