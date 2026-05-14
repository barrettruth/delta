import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: 7, username: "owner", apiKey: "key", createdAt: "now" },
  cookie: {
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

const oauth = vi.hoisted(() => ({
  buildGoogleAuthorizationUrl: vi.fn(),
  googleRedirectUri: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => state.cookie),
}));
vi.mock("@/lib/auth-responses", () => ({
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));
vi.mock("@/lib/request-auth", () => ({
  getApiKeyUserOrLocalOwnerFromRequest: vi.fn(async () => state.user),
}));
vi.mock("@/core/google/oauth", () => oauth);

describe("GET /api/integrations/google/connect", () => {
  it("preserves the current return target through the OAuth handoff", async () => {
    vi.clearAllMocks();
    oauth.googleRedirectUri.mockReturnValue(
      "http://delta.test/api/integrations/google/callback",
    );
    oauth.buildGoogleAuthorizationUrl.mockReturnValue(
      "https://accounts.google.com/auth",
    );
    const { GET } = await import("@/app/api/integrations/google/connect/route");

    const response = await GET(
      new Request(
        "http://delta.test/api/integrations/google/connect?returnTo=%2Fcalendar%3Fmode%3Dweek",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://accounts.google.com/auth",
    );
    expect(state.cookie.set).toHaveBeenCalledWith(
      "google_oauth_state",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
    expect(state.cookie.set).toHaveBeenCalledWith(
      "google_oauth_return_to",
      "/calendar?mode=week",
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
  });

  it("drops unsafe return targets", async () => {
    vi.clearAllMocks();
    oauth.googleRedirectUri.mockReturnValue(
      "http://delta.test/api/integrations/google/callback",
    );
    oauth.buildGoogleAuthorizationUrl.mockReturnValue(
      "https://accounts.google.com/auth",
    );
    const { GET } = await import("@/app/api/integrations/google/connect/route");

    await GET(
      new Request(
        "http://delta.test/api/integrations/google/connect?returnTo=https%3A%2F%2Fevil.test",
      ),
    );

    expect(state.cookie.delete).toHaveBeenCalledWith("google_oauth_return_to");
  });
});
