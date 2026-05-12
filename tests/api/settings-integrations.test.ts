import { describe, expect, it, vi } from "vitest";
import {
  type ApiRouteTestState,
  installApiRouteTestHarness,
  jsonRequest,
  responseJson,
} from "./helpers";

const state = vi.hoisted(
  (): ApiRouteTestState => ({
    db: undefined as unknown as ApiRouteTestState["db"],
    user: undefined as unknown as ApiRouteTestState["user"],
  }),
);

installApiRouteTestHarness(state, {
  username: "settingsintegrations",
});

function request(body: Record<string, unknown>) {
  return jsonRequest("/api/settings/integrations", body);
}

describe("POST /api/settings/integrations", () => {
  it("accepts registered settings providers with the canonical token field", async () => {
    const { POST } = await import("@/app/api/settings/integrations/route");

    const response = await POST(
      request({
        provider: "mapbox",
        tokens: { api_key: "test-provider-key" },
      }),
    );

    expect(response.status).toBe(201);
    const body = await responseJson(response);
    expect(body).toMatchObject({
      provider: "mapbox",
      enabled: 1,
    });
    expect(JSON.stringify(body)).not.toContain("test-provider-key");
  });

  it("rejects unregistered provider IDs and noncanonical token fields", async () => {
    const { POST } = await import("@/app/api/settings/integrations/route");

    expect(
      await responseJson(
        await POST(
          request({
            provider: "unknown",
            tokens: { api_key: "test-provider-key" },
          }),
        ),
      ),
    ).toEqual({ error: "invalid provider" });

    const response = await POST(
      request({
        provider: "mapbox",
        tokens: { apiKey: "test-provider-key" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toEqual({
      error: "api key is required",
    });
  });
});
