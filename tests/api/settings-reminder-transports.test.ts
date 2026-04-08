import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSystemConfig } from "@/core/system-config";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const mockState = vi.hoisted(() => ({
  db: null as Db | null,
  user: null as { id: number } | null,
}));

vi.mock("@/db", () => ({
  get db() {
    return mockState.db;
  },
}));

vi.mock("@/lib/auth-middleware", () => ({
  getAuthUserFromRequest: vi.fn(async () => mockState.user),
  unauthorized: () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
}));

import {
  DELETE,
  GET,
  PUT,
} from "@/app/api/settings/reminders/transports/[adapter]/route";

function buildRequest(
  path: string,
  init: {
    method?: string;
    body?: unknown;
  } = {},
): Request {
  const headers = new Headers();
  let body: string | undefined;

  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.body);
  }

  return new Request(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers,
    body,
  });
}

beforeEach(() => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
  mockState.db = createTestDb();
  mockState.user = createTestUser(mockState.db);
});

describe("/api/settings/reminders/transports/[adapter]", () => {
  it("returns unauthorized without an authenticated user", async () => {
    mockState.user = null;

    const response = await GET(
      buildRequest("/api/settings/reminders/transports/sms.twilio"),
      { params: Promise.resolve({ adapter: "sms.twilio" }) },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns config status for a supported reminder transport", async () => {
    const response = await GET(
      buildRequest("/api/settings/reminders/transports/telegram.bot_api"),
      { params: Promise.resolve({ adapter: "telegram.bot_api" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      adapterKey: "telegram.bot_api",
      configured: false,
      missingFields: ["botToken"],
    });
  });

  it("stores Twilio transport config without exposing secrets", async () => {
    const response = await PUT(
      buildRequest("/api/settings/reminders/transports/sms.twilio", {
        method: "PUT",
        body: {
          values: {
            accountSid: " AC123 ",
            authToken: " token-123 ",
            fromNumber: " +15125550123 ",
          },
        },
      }),
      { params: Promise.resolve({ adapter: "sms.twilio" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      adapterKey: "sms.twilio",
      configured: true,
      missingFields: [],
    });
    expect(
      getSystemConfig(mockState.db as Db, "reminders.sms.twilio.account_sid"),
    ).toBe("AC123");
    expect(
      getSystemConfig(mockState.db as Db, "reminders.sms.twilio.auth_token"),
    ).toBe("token-123");
    expect(
      getSystemConfig(mockState.db as Db, "reminders.sms.twilio.from_number"),
    ).toBe("+15125550123");
  });

  it("rejects invalid reminder transport payloads", async () => {
    const invalidAdapter = await PUT(
      buildRequest("/api/settings/reminders/transports/nope", {
        method: "PUT",
        body: { values: {} },
      }),
      { params: Promise.resolve({ adapter: "nope" }) },
    );
    expect(invalidAdapter.status).toBe(400);
    expect(await invalidAdapter.json()).toEqual({
      error: "Invalid reminder transport",
    });

    const missingField = await PUT(
      buildRequest("/api/settings/reminders/transports/telegram.bot_api", {
        method: "PUT",
        body: { values: { botToken: "   " } },
      }),
      { params: Promise.resolve({ adapter: "telegram.bot_api" }) },
    );
    expect(missingField.status).toBe(400);
    expect(await missingField.json()).toEqual({
      error: "bot token is required",
    });
  });

  it("deletes stored reminder transport config", async () => {
    await PUT(
      buildRequest("/api/settings/reminders/transports/telegram.bot_api", {
        method: "PUT",
        body: { values: { botToken: "bot-123" } },
      }),
      { params: Promise.resolve({ adapter: "telegram.bot_api" }) },
    );

    const response = await DELETE(
      buildRequest("/api/settings/reminders/transports/telegram.bot_api", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ adapter: "telegram.bot_api" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      adapterKey: "telegram.bot_api",
      configured: false,
      missingFields: ["botToken"],
    });
    expect(
      getSystemConfig(
        mockState.db as Db,
        "reminders.telegram.bot_api.bot_token",
      ),
    ).toBe(null);
  });
});
