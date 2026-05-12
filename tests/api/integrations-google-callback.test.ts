import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: 7, username: "owner", apiKey: "key", createdAt: "now" },
  cookie: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

const oauth = vi.hoisted(() => ({
  exchangeGoogleCode: vi.fn(),
  fetchGoogleUserInfo: vi.fn(),
  getGoogleIntegration: vi.fn(),
  googleRedirectUri: vi.fn(),
  hasGoogleTasksScope: vi.fn(),
  saveGoogleIntegration: vi.fn(),
}));

vi.mock("@/db", () => ({ db: {} }));
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

function callbackRequest(query: string) {
  return new Request(
    `http://delta.test/api/integrations/google/callback${query}`,
  );
}

function redirectStatus(response: Response): string | null {
  return new URL(response.headers.get("location") ?? "").searchParams.get(
    "google",
  );
}

describe("GET /api/integrations/google/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.cookie.get.mockReturnValue({ value: "expected-state" });
    oauth.googleRedirectUri.mockReturnValue(
      "http://delta.test/api/integrations/google/callback",
    );
    oauth.getGoogleIntegration.mockReturnValue(null);
    oauth.fetchGoogleUserInfo.mockResolvedValue({
      email: "owner@example.test",
      name: "Owner",
    });
  });

  it("rejects callback requests with an invalid OAuth state", async () => {
    const { GET } = await import(
      "@/app/api/integrations/google/callback/route"
    );

    const response = await GET(callbackRequest("?code=code&state=wrong"));

    expect(response.status).toBe(307);
    expect(redirectStatus(response)).toBe("invalid-state");
    expect(state.cookie.delete).toHaveBeenCalledWith("google_oauth_state");
    expect(oauth.exchangeGoogleCode).not.toHaveBeenCalled();
  });

  it("rejects tokens that did not receive the Tasks scope", async () => {
    oauth.exchangeGoogleCode.mockResolvedValue({
      accessToken: "access-token",
      scope: "openid email",
    });
    oauth.hasGoogleTasksScope.mockReturnValue(false);
    const { GET } = await import(
      "@/app/api/integrations/google/callback/route"
    );

    const response = await GET(
      callbackRequest("?code=code&state=expected-state"),
    );

    expect(redirectStatus(response)).toBe("missing-tasks-scope");
    expect(oauth.saveGoogleIntegration).not.toHaveBeenCalled();
  });

  it("saves the shared Google connection after a scoped callback", async () => {
    const tokens = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      scope: "openid email https://www.googleapis.com/auth/tasks.readonly",
    };
    oauth.exchangeGoogleCode.mockResolvedValue(tokens);
    oauth.hasGoogleTasksScope.mockReturnValue(true);
    const { GET } = await import(
      "@/app/api/integrations/google/callback/route"
    );

    const response = await GET(
      callbackRequest("?code=code&state=expected-state"),
    );

    expect(redirectStatus(response)).toBe("connected");
    expect(oauth.exchangeGoogleCode).toHaveBeenCalledWith(
      "code",
      "http://delta.test/api/integrations/google/callback",
      undefined,
    );
    expect(oauth.saveGoogleIntegration).toHaveBeenCalledWith(
      {},
      7,
      tokens,
      expect.objectContaining({
        email: "owner@example.test",
        name: "Owner",
        grantedScopes: tokens.scope.split(" "),
        lastError: undefined,
      }),
    );
  });
});
