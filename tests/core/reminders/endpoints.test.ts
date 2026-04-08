import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createReminderEndpoint,
  deleteReminderEndpoint,
  getReminderEndpoint,
  listReminderEndpoints,
  setReminderEndpointTestResult,
  updateReminderEndpoint,
} from "@/core/reminders/endpoints";
import type { Db } from "@/core/types";
import { reminderEndpoints } from "@/db/schema";
import { createTestDb, createTestUser } from "../../helpers";

const TEST_KEY = randomBytes(32).toString("hex");

let db: Db;
let userId: number;

beforeEach(() => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
  db = createTestDb();
  userId = createTestUser(db).id;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createReminderEndpoint", () => {
  it("creates an endpoint with decrypted target in the return value", () => {
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "sms.twilio",
      label: "sms main",
      target: "+15125501381",
      metadata: { purpose: "manual-test" },
    });

    expect(endpoint.id).toBe(1);
    expect(endpoint.adapterKey).toBe("sms.twilio");
    expect(endpoint.label).toBe("sms main");
    expect(endpoint.target).toBe("+15125501381");
    expect(endpoint.metadata).toEqual({ purpose: "manual-test" });
    expect(endpoint.enabled).toBe(1);
  });

  it("stores the endpoint target encrypted at rest", () => {
    createReminderEndpoint(db, userId, {
      adapterKey: "telegram.bot_api",
      label: "telegram",
      target: "123456789",
    });

    const raw = db
      .select()
      .from(reminderEndpoints)
      .where(eq(reminderEndpoints.userId, userId))
      .get();

    expect(raw).not.toBeNull();
    expect(raw?.encryptedTarget).not.toContain("123456789");
    expect(raw?.encryptedTarget).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });
});

describe("getReminderEndpoint / listReminderEndpoints", () => {
  it("returns null for nonexistent endpoint", () => {
    expect(getReminderEndpoint(db, userId, 1)).toBeNull();
  });

  it("does not return another user's endpoint", () => {
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "slack.webhook",
      label: "slack",
      target: "https://hooks.slack.test/a",
    });
    const otherUser = createTestUser(db, "other-user");

    expect(getReminderEndpoint(db, otherUser.id, endpoint.id)).toBeNull();
  });

  it("lists only the current user's endpoints", () => {
    createReminderEndpoint(db, userId, {
      adapterKey: "sms.twilio",
      label: "sms",
      target: "+15125501381",
    });

    const otherUser = createTestUser(db, "other-user");
    createReminderEndpoint(db, otherUser.id, {
      adapterKey: "telegram.bot_api",
      label: "telegram",
      target: "42",
    });

    const list = listReminderEndpoints(db, userId);
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe("sms");
  });
});

describe("updateReminderEndpoint", () => {
  it("updates label, target, metadata, and enabled state", () => {
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "discord.webhook",
      label: "discord",
      target: "https://discord.test/old",
      metadata: { channel: "ops" },
    });

    const updated = updateReminderEndpoint(db, userId, endpoint.id, {
      label: "discord updated",
      target: "https://discord.test/new",
      metadata: { channel: "alerts" },
      enabled: 0,
    });

    expect(updated).not.toBeNull();
    expect(updated?.label).toBe("discord updated");
    expect(updated?.target).toBe("https://discord.test/new");
    expect(updated?.metadata).toEqual({ channel: "alerts" });
    expect(updated?.enabled).toBe(0);
  });

  it("can clear metadata", () => {
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "slack.webhook",
      label: "slack",
      target: "https://hooks.slack.test/a",
      metadata: { room: "private" },
    });

    const updated = updateReminderEndpoint(db, userId, endpoint.id, {
      metadata: null,
    });

    expect(updated?.metadata).toBeNull();
  });
});

describe("setReminderEndpointTestResult", () => {
  it("records successful test state", () => {
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "telegram.bot_api",
      label: "telegram",
      target: "123",
    });

    const updated = setReminderEndpointTestResult(
      db,
      userId,
      endpoint.id,
      "ok",
    );

    expect(updated?.lastTestStatus).toBe("ok");
    expect(updated?.lastTestAt).toBeTruthy();
    expect(updated?.lastTestError).toBeNull();
  });

  it("records failed test state", () => {
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "sms.twilio",
      label: "sms",
      target: "+15555550123",
    });

    const updated = setReminderEndpointTestResult(
      db,
      userId,
      endpoint.id,
      "failed",
      "unreachable",
    );

    expect(updated?.lastTestStatus).toBe("failed");
    expect(updated?.lastTestError).toBe("unreachable");
  });
});

describe("deleteReminderEndpoint", () => {
  it("deletes an endpoint", () => {
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "sms.twilio",
      label: "sms",
      target: "+15125501381",
    });

    expect(deleteReminderEndpoint(db, userId, endpoint.id)).toBe(true);
    expect(getReminderEndpoint(db, userId, endpoint.id)).toBeNull();
  });

  it("returns false for nonexistent endpoint", () => {
    expect(deleteReminderEndpoint(db, userId, 999)).toBe(false);
  });
});
