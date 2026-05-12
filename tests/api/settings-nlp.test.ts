import { describe, expect, it, vi } from "vitest";
import {
  getIntegrationConfig,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import { nlpProviderKey, nlpTokens } from "@/core/provider-registry";
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
  auth: "local-owner",
  username: "settingsnlp",
});

describe("/api/settings/nlp", () => {
  it("stores the selected provider token under the parser contract", async () => {
    const { GET, PUT } = await import("@/app/api/settings/nlp/route");

    const response = await PUT(
      jsonRequest(
        "/api/settings/nlp",
        {
          provider: "anthropic",
          apiKey: "test-secret",
        },
        {
          method: "PUT",
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(responseJson(response)).resolves.toMatchObject({
      ok: true,
      provider: "anthropic",
      model: "claude-haiku-4-5-latest",
    });

    const config = getIntegrationConfig(
      state.db,
      state.user.id,
      nlpProviderKey("anthropic"),
    );
    expect(config?.tokens).toEqual({ api_key: "test-secret" });
    expect(config?.tokens).not.toHaveProperty("apiKey");

    const settings = await responseJson(await GET());
    expect(settings.activeProvider).toBe("anthropic");
    expect(settings.anthropicConfigured).toBe(true);
    expect(JSON.stringify(settings)).not.toContain("test-secret");
  });

  it("selects one enabled provider and disables the previous NLP provider", async () => {
    const { PATCH } = await import("@/app/api/settings/nlp/route");
    upsertIntegrationConfig(
      state.db,
      state.user.id,
      nlpProviderKey("anthropic"),
      nlpTokens("test-secret"),
    );
    upsertIntegrationConfig(
      state.db,
      state.user.id,
      nlpProviderKey("openai"),
      nlpTokens("test-secret"),
    );

    const response = await PATCH(
      jsonRequest(
        "/api/settings/nlp",
        { provider: "openai" },
        {
          method: "PATCH",
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(
      getIntegrationConfig(state.db, state.user.id, nlpProviderKey("openai"))
        ?.enabled,
    ).toBe(1);
    expect(
      getIntegrationConfig(state.db, state.user.id, nlpProviderKey("anthropic"))
        ?.enabled,
    ).toBe(0);
  });

  it("does not mark a provider active when the stored token is missing", async () => {
    const { GET } = await import("@/app/api/settings/nlp/route");
    upsertIntegrationConfig(
      state.db,
      state.user.id,
      nlpProviderKey("anthropic"),
      {},
    );

    const settings = await responseJson(await GET());

    expect(settings.activeProvider).toBeNull();
    expect(settings.anthropicConfigured).toBe(false);
  });
});
