import { describe, expect, it, vi } from "vitest";
import {
  getIntegrationConfig,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import {
  type ApiRouteTestState,
  apiRequest,
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

describe("/api/settings/integrations/[provider]", () => {
  it("rejects unregistered provider IDs before mutating configs", async () => {
    const { DELETE, PATCH } = await import(
      "@/app/api/settings/integrations/[provider]/route"
    );

    const deleteResponse = await DELETE(
      apiRequest("/api/settings/integrations/unknown", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ provider: "unknown" }) },
    );
    expect(deleteResponse.status).toBe(400);
    await expect(responseJson(deleteResponse)).resolves.toEqual({
      error: "invalid provider",
    });

    const patchResponse = await PATCH(
      apiRequest("/api/settings/integrations/unknown", {
        method: "PATCH",
        body: JSON.stringify({ metadata: { model: "test-model" } }),
      }),
      { params: Promise.resolve({ provider: "unknown" }) },
    );
    expect(patchResponse.status).toBe(400);
    await expect(responseJson(patchResponse)).resolves.toEqual({
      error: "invalid provider",
    });
  });

  it("patches metadata only for registered settings integration providers", async () => {
    const { PATCH } = await import(
      "@/app/api/settings/integrations/[provider]/route"
    );
    upsertIntegrationConfig(
      state.db,
      state.user.id,
      "mapbox",
      { api_key: "test-provider-key" },
      { name: "old" },
    );

    const response = await PATCH(
      apiRequest("/api/settings/integrations/mapbox", {
        method: "PATCH",
        body: JSON.stringify({ metadata: { name: "new" } }),
      }),
      { params: Promise.resolve({ provider: "mapbox" }) },
    );

    expect(response.status).toBe(200);
    expect(getIntegrationConfig(state.db, state.user.id, "mapbox")).toEqual(
      expect.objectContaining({
        metadata: { name: "new" },
      }),
    );
  });
});
