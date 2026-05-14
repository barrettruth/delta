import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleCode,
  getGoogleAccessToken,
  googleRedirectUri,
  hasGoogleCalendarScopes,
  hasGoogleTasksScope,
} from "@/core/google/oauth";
import { upsertIntegrationConfig } from "@/core/integration-config";
import { createTestDb, createTestUser } from "../../helpers";

const TEST_KEY = randomBytes(32).toString("hex");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Google OAuth helpers", () => {
  it("builds the documented callback URL from the request origin", () => {
    expect(
      googleRedirectUri(
        new Request("https://delta.example.test/settings/calendar"),
      ),
    ).toBe("https://delta.example.test/api/integrations/google/callback");
  });

  it("uses the configured public origin for proxied callback URLs", () => {
    vi.stubEnv("DELTA_PUBLIC_ORIGIN", "https://delta.example.test/");

    expect(
      googleRedirectUri(
        new Request("https://localhost:3001/settings/calendar"),
      ),
    ).toBe("https://delta.example.test/api/integrations/google/callback");
  });

  it("requests offline Google Calendar and Tasks scopes", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");

    const url = new URL(
      buildGoogleAuthorizationUrl(
        "state-value",
        "https://delta.example.test/api/integrations/google/callback",
      ),
    );

    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    expect(url.searchParams.get("scope")).toContain(
      "https://www.googleapis.com/auth/tasks.readonly",
    );
    expect(url.searchParams.get("scope")).toContain(
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    );
    expect(url.searchParams.get("scope")).toContain(
      "https://www.googleapis.com/auth/calendar.events.readonly",
    );
  });

  it("preserves an existing refresh token when Google omits a new one", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          access_token: "new-access",
          expires_in: 3600,
          scope: "openid",
          token_type: "Bearer",
        }),
      ),
    );

    const tokens = await exchangeGoogleCode(
      "code",
      "https://delta.example.test/api/integrations/google/callback",
      { accessToken: "old-access", refreshToken: "old-refresh" },
    );

    expect(tokens.accessToken).toBe("new-access");
    expect(tokens.refreshToken).toBe("old-refresh");
  });

  it("detects missing Tasks scope on callback tokens", () => {
    expect(
      hasGoogleTasksScope({
        accessToken: "access",
        scope: "openid email",
      }),
    ).toBe(false);
    expect(hasGoogleTasksScope({ accessToken: "access" })).toBe(false);
  });

  it("detects missing Calendar scopes on callback tokens", () => {
    expect(
      hasGoogleCalendarScopes({
        accessToken: "access",
        scope:
          "openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      }),
    ).toBe(false);
    expect(
      hasGoogleCalendarScopes({
        accessToken: "access",
        scope:
          "https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events.readonly",
      }),
    ).toBe(true);
    expect(
      hasGoogleCalendarScopes({
        accessToken: "access",
        scope: "https://www.googleapis.com/auth/calendar.readonly",
      }),
    ).toBe(true);
  });

  it("refreshes expired tokens from encrypted integration storage", async () => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          access_token: "refreshed-access",
          expires_in: 3600,
        }),
      ),
    );
    const db = createTestDb();
    const user = createTestUser(db, "googleoauth");
    upsertIntegrationConfig(db, user.id, "google", {
      accessToken: "expired",
      refreshToken: "refresh",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(getGoogleAccessToken(db, user.id)).resolves.toBe(
      "refreshed-access",
    );
  });
});
