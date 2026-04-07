import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueReminderDelivery } from "@/core/reminders/deliveries";
import {
  dispatchReminderDelivery,
  sendReminderEndpointTest,
} from "@/core/reminders/dispatch";
import {
  createReminderEndpoint,
  getReminderEndpoint,
} from "@/core/reminders/endpoints";
import { createTaskReminder } from "@/core/reminders/rules";
import { setSystemConfig } from "@/core/system-config";
import { createTask } from "@/core/task";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../../helpers";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

let db: Db;
let userId: number;

function createDeliveryFixture(
  adapterKey:
    | "sms.twilio"
    | "telegram.bot_api"
    | "slack.webhook"
    | "discord.webhook"
    | "signal.signal_cli",
  target: string,
) {
  const task = createTask(db, userId, {
    description: `Task for ${adapterKey}`,
    due: "2026-04-06T15:30:00.000Z",
  });
  const endpoint = createReminderEndpoint(db, userId, {
    adapterKey,
    label: adapterKey,
    target,
  });
  const reminder = createTaskReminder(db, userId, {
    taskId: task.id,
    endpointId: endpoint.id,
    anchor: "due",
    offsetMinutes: -10,
  });
  const delivery = enqueueReminderDelivery(db, {
    userId,
    taskId: task.id,
    taskReminderId: reminder.id,
    endpointId: endpoint.id,
    adapterKey,
    scheduledFor: "2026-04-06T15:20:00.000Z",
  });

  return { task, endpoint, reminder, delivery };
}

beforeEach(() => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
  vi.unstubAllGlobals();
  execFileMock.mockReset();
  db = createTestDb();
  userId = createTestUser(db).id;
});

describe("dispatchReminderDelivery", () => {
  it("dispatches Slack webhook deliveries and marks them sent", async () => {
    const { delivery, task } = createDeliveryFixture(
      "slack.webhook",
      "https://slack.test/hook",
    );
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const sent = await dispatchReminderDelivery(db, delivery.id, {
      nowIso: "2026-04-06T15:20:00.000Z",
    });

    expect(sent?.status).toBe("sent");
    expect(sent?.renderedBody).toContain(task.description);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slack.test/hook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const request = (
      fetchMock.mock.calls[0] as unknown as [string, { body: string }]
    )[1] as {
      body: string;
    };
    expect(JSON.parse(request.body)).toMatchObject({
      text: expect.stringContaining(task.description),
    });
  });

  it("dispatches Twilio SMS deliveries with system config", async () => {
    setSystemConfig(db, "reminders.sms.twilio.account_sid", "AC123");
    setSystemConfig(db, "reminders.sms.twilio.auth_token", "token-123");
    setSystemConfig(db, "reminders.sms.twilio.from_number", "+15125559999");

    const { delivery } = createDeliveryFixture("sms.twilio", "+15125550109");
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ sid: "SM123" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const sent = await dispatchReminderDelivery(db, delivery.id, {
      nowIso: "2026-04-06T15:20:00.000Z",
    });

    expect(sent?.status).toBe("sent");
    expect(sent?.providerMessageId).toBe("SM123");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("AC123:token-123").toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        }),
      }),
    );
    const request = (
      fetchMock.mock.calls[0] as unknown as [string, { body: URLSearchParams }]
    )[1] as {
      body: URLSearchParams;
    };
    expect(request.body.get("To")).toBe("+15125550109");
    expect(request.body.get("From")).toBe("+15125559999");
    expect(request.body.get("Body")).toContain("Task for sms.twilio");
  });

  it("marks permanent adapter failures as dead", async () => {
    const { delivery } = createDeliveryFixture(
      "discord.webhook",
      "https://discord.test/hook",
    );
    const fetchMock = vi.fn(
      async () => new Response("bad request", { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const failed = await dispatchReminderDelivery(db, delivery.id, {
      nowIso: "2026-04-06T15:20:00.000Z",
    });

    expect(failed?.status).toBe("dead");
    expect(failed?.error).toContain("unexpected error (400)");
  });

  it("marks transient adapter failures for retry", async () => {
    const { delivery } = createDeliveryFixture(
      "discord.webhook",
      "https://discord.test/hook",
    );
    const fetchMock = vi.fn(async () => new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const failed = await dispatchReminderDelivery(db, delivery.id, {
      nowIso: "2026-04-06T15:20:00.000Z",
    });

    expect(failed?.status).toBe("failed");
    expect(failed?.nextAttemptAt).toBeTruthy();
  });

  it("dispatches Signal deliveries through signal-cli", async () => {
    setSystemConfig(db, "reminders.signal.signal_cli.account", "+15125559998");
    setSystemConfig(
      db,
      "reminders.signal.signal_cli.config_path",
      "/var/lib/signal-cli",
    );
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: { timeout: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(null, "", "");
        return {} as never;
      },
    );

    const { delivery } = createDeliveryFixture(
      "signal.signal_cli",
      "+15125550110",
    );

    const sent = await dispatchReminderDelivery(db, delivery.id, {
      nowIso: "2026-04-06T15:20:00.000Z",
    });

    expect(sent?.status).toBe("sent");
    expect(execFileMock).toHaveBeenCalledWith(
      "signal-cli",
      [
        "--config",
        "/var/lib/signal-cli",
        "-a",
        "+15125559998",
        "send",
        "-m",
        expect.stringContaining("Task for signal.signal_cli"),
        "+15125550110",
      ],
      { timeout: 30_000 },
      expect.any(Function),
    );
  });

  it("marks Signal deliveries as dead when signal-cli is missing", async () => {
    setSystemConfig(db, "reminders.signal.signal_cli.account", "+15125559998");
    setSystemConfig(
      db,
      "reminders.signal.signal_cli.config_path",
      "/var/lib/signal-cli",
    );
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: { timeout: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(
          Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" }),
          "",
          "",
        );
        return {} as never;
      },
    );

    const { delivery } = createDeliveryFixture(
      "signal.signal_cli",
      "+15125550110",
    );

    const failed = await dispatchReminderDelivery(db, delivery.id, {
      nowIso: "2026-04-06T15:20:00.000Z",
    });

    expect(failed?.status).toBe("dead");
    expect(failed?.error).toContain("signal-cli is not installed");
  });
});

describe("sendReminderEndpointTest", () => {
  it("sends a Slack endpoint test and records success", async () => {
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "slack.webhook",
      label: "Slack",
      target: "https://slack.test/test-hook",
    });
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendReminderEndpointTest(db, userId, endpoint.id, {
      body: "Reminder test body",
    });

    expect(result.endpoint.lastTestStatus).toBe("ok");
    expect(result.providerMessageId).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("records failed endpoint tests", async () => {
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "slack.webhook",
      label: "Slack",
      target: "https://slack.test/test-hook",
    });
    const fetchMock = vi.fn(
      async () => new Response("bad request", { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendReminderEndpointTest(db, userId, endpoint.id, {
        body: "Reminder test body",
      }),
    ).rejects.toThrow("unexpected error (400)");

    expect(getReminderEndpoint(db, userId, endpoint.id)?.lastTestStatus).toBe(
      "failed",
    );
  });

  it("sends a Signal endpoint test through signal-cli", async () => {
    setSystemConfig(db, "reminders.signal.signal_cli.account", "+15125559998");
    setSystemConfig(
      db,
      "reminders.signal.signal_cli.config_path",
      "/var/lib/signal-cli",
    );
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: { timeout: number },
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(null, "", "");
        return {} as never;
      },
    );
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "signal.signal_cli",
      label: "Signal",
      target: "+15125550111",
    });

    const result = await sendReminderEndpointTest(db, userId, endpoint.id, {
      body: "Signal reminder test",
    });

    expect(result.endpoint.lastTestStatus).toBe("ok");
    expect(result.providerMessageId).toBeNull();
    expect(execFileMock).toHaveBeenCalledWith(
      "signal-cli",
      [
        "--config",
        "/var/lib/signal-cli",
        "-a",
        "+15125559998",
        "send",
        "-m",
        "Signal reminder test",
        "+15125550111",
      ],
      { timeout: 30_000 },
      expect.any(Function),
    );
  });

  it("throws for nonexistent endpoints", async () => {
    await expect(sendReminderEndpointTest(db, userId, 999)).rejects.toThrow(
      "Reminder endpoint 999 not found",
    );
  });
});
