import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SafeUser } from "@/core/auth";
import {
  setIntegrationEnabled,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import type { Db } from "@/core/types";
import { nlpProviderKey, nlpTokens } from "@/lib/nlp-models";
import { createTestDb, createTestUser } from "../helpers";

const state = vi.hoisted(() => ({
  db: undefined as unknown as Db,
  user: undefined as unknown as SafeUser,
}));

vi.mock("@/db", () => ({
  get db() {
    return state.db;
  },
}));

vi.mock("@/lib/auth-middleware", () => ({
  getAuthUserFromRequest: vi.fn(async () => state.user),
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

const TEST_KEY = randomBytes(32).toString("hex");

function parseRequest(text: string) {
  return new Request("http://delta.test/api/nlp/parse-recurrence", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("/api/nlp/parse-recurrence", () => {
  beforeEach(() => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
    vi.stubGlobal("fetch", vi.fn());
    state.db = createTestDb();
    state.user = createTestUser(state.db, "parsenlp");
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

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
    const body = await json(response);

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
    const body = await json(response);

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
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.source).toBe("local");
    expect(fetch).not.toHaveBeenCalled();
  });
});
