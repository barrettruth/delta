import { describe, expect, it, vi } from "vitest";
import {
  setIntegrationEnabled,
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
  restoreMocks: true,
  stubFetch: true,
  username: "parsenlp",
});

function parseRequest(text: string) {
  return jsonRequest("/api/nlp/parse-recurrence", { text });
}

describe("/api/nlp/parse-recurrence", () => {
  it("uses the enabled NLP provider when local parsing needs fallback", async () => {
    const { POST } = await import("@/app/api/nlp/parse-recurrence/route");
    upsertIntegrationConfig(
      state.db,
      state.user.id,
      nlpProviderKey("openai"),
      nlpTokens("test-secret"),
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '{"rrule": "FREQ=MONTHLY;BYMONTHDAY=15", "confidence": 0.9}',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const response = await POST(parseRequest("on the 15th of every month"));
    const body = await responseJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      rrule: "FREQ=MONTHLY;BYMONTHDAY=15",
      source: "openai",
    });
    expect(JSON.stringify(body)).not.toContain("test-secret");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-secret",
        }),
      }),
    );
  });

  it("falls back to deterministic parsing when the provider is disabled", async () => {
    const { POST } = await import("@/app/api/nlp/parse-recurrence/route");
    upsertIntegrationConfig(
      state.db,
      state.user.id,
      nlpProviderKey("anthropic"),
      nlpTokens("test-secret"),
    );
    setIntegrationEnabled(
      state.db,
      state.user.id,
      nlpProviderKey("anthropic"),
      0,
    );

    const response = await POST(parseRequest("daily"));
    const body = await responseJson(response);

    expect(response.status).toBe(200);
    expect(body.source).toBe("local");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to deterministic parsing when the enabled provider has no token", async () => {
    const { POST } = await import("@/app/api/nlp/parse-recurrence/route");
    upsertIntegrationConfig(
      state.db,
      state.user.id,
      nlpProviderKey("anthropic"),
      {},
    );

    const response = await POST(parseRequest("weekly"));
    const body = await responseJson(response);

    expect(response.status).toBe(200);
    expect(body.source).toBe("local");
    expect(fetch).not.toHaveBeenCalled();
  });
});
