import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createReminderEndpoint,
  getReminderEndpoint,
} from "@/core/reminders/endpoints";
import { listReminderAdapters } from "@/core/reminders/registry";
import {
  createTaskReminder,
  getTaskReminder,
  listTaskReminders,
} from "@/core/reminders/rules";
import { createTask } from "@/core/task";
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

import { GET as getReminderAdapters } from "@/app/api/reminders/adapters/route";
import {
  DELETE as deleteReminderEndpointById,
  GET as getReminderEndpointById,
  PATCH as patchReminderEndpointById,
} from "@/app/api/reminders/endpoints/[id]/route";
import { POST as postReminderEndpointTest } from "@/app/api/reminders/endpoints/[id]/test/route";
import {
  POST as createReminderEndpointRoute,
  GET as listReminderEndpointsRoute,
} from "@/app/api/reminders/endpoints/route";
import {
  DELETE as deleteTaskReminderRoute,
  PATCH as patchTaskReminderRoute,
} from "@/app/api/tasks/[id]/reminders/[reminderId]/route";
import {
  POST as createTaskReminderRoute,
  GET as listTaskRemindersRoute,
} from "@/app/api/tasks/[id]/reminders/route";

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

describe("GET /api/reminders/adapters", () => {
  it("returns unauthorized without an authenticated user", async () => {
    mockState.user = null;

    const response = await getReminderAdapters(
      buildRequest("/api/reminders/adapters"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns reminder adapter manifests", async () => {
    const response = await getReminderAdapters(
      buildRequest("/api/reminders/adapters"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(listReminderAdapters());
  });
});

describe("/api/reminders/endpoints", () => {
  it("lists only the current user's reminder endpoints", async () => {
    const db = mockState.db as Db;
    const userId = mockState.user?.id as number;
    const otherUser = createTestUser(db);
    const mine = createReminderEndpoint(db, userId, {
      adapterKey: "sms.twilio",
      label: "My phone",
      target: "+15125550101",
    });

    createReminderEndpoint(db, otherUser.id, {
      adapterKey: "telegram.bot_api",
      label: "Other bot",
      target: "999",
    });

    const response = await listReminderEndpointsRoute(
      buildRequest("/api/reminders/endpoints"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: mine.id,
      adapterKey: "sms.twilio",
      label: "My phone",
      target: "+15125550101",
    });
  });

  it("creates a reminder endpoint", async () => {
    const db = mockState.db as Db;
    const userId = mockState.user?.id as number;

    const response = await createReminderEndpointRoute(
      buildRequest("/api/reminders/endpoints", {
        method: "POST",
        body: {
          adapterKey: "slack.webhook",
          label: "Work Slack",
          target: "https://slack.test/hook",
          metadata: { channel: "alerts" },
          enabled: 0,
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      adapterKey: "slack.webhook",
      label: "Work Slack",
      target: "https://slack.test/hook",
      metadata: { channel: "alerts" },
      enabled: 0,
    });
    expect(getReminderEndpoint(db, userId, body.id)?.target).toBe(
      "https://slack.test/hook",
    );
  });

  it("rejects invalid endpoint payloads", async () => {
    const response = await createReminderEndpointRoute(
      buildRequest("/api/reminders/endpoints", {
        method: "POST",
        body: {
          adapterKey: "email.smtp",
          label: "",
          target: "",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Validation failed");
  });
});

describe("/api/reminders/endpoints/[id]", () => {
  it("returns 404 for another user's endpoint", async () => {
    const db = mockState.db as Db;
    const otherUser = createTestUser(db);
    const endpoint = createReminderEndpoint(db, otherUser.id, {
      adapterKey: "sms.twilio",
      label: "Other phone",
      target: "+15125550102",
    });

    const response = await getReminderEndpointById(
      buildRequest(`/api/reminders/endpoints/${endpoint.id}`),
      { params: Promise.resolve({ id: String(endpoint.id) }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Reminder endpoint not found",
    });
  });

  it("updates an endpoint and can clear metadata", async () => {
    const db = mockState.db as Db;
    const userId = mockState.user?.id as number;
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "discord.webhook",
      label: "Discord",
      target: "https://discord.test/hook",
      metadata: { guild: "one" },
    });

    const response = await patchReminderEndpointById(
      buildRequest(`/api/reminders/endpoints/${endpoint.id}`, {
        method: "PATCH",
        body: {
          label: "Discord alerts",
          target: "https://discord.test/new-hook",
          metadata: null,
          enabled: 0,
        },
      }),
      { params: Promise.resolve({ id: String(endpoint.id) }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: endpoint.id,
      label: "Discord alerts",
      target: "https://discord.test/new-hook",
      metadata: null,
      enabled: 0,
    });
    expect(getReminderEndpoint(db, userId, endpoint.id)?.target).toBe(
      "https://discord.test/new-hook",
    );
  });

  it("deletes an endpoint", async () => {
    const db = mockState.db as Db;
    const userId = mockState.user?.id as number;
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "telegram.bot_api",
      label: "Telegram",
      target: "321",
    });

    const response = await deleteReminderEndpointById(
      buildRequest(`/api/reminders/endpoints/${endpoint.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: String(endpoint.id) }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(getReminderEndpoint(db, userId, endpoint.id)).toBeNull();
  });

  it("sends a reminder endpoint test and records test status", async () => {
    const db = mockState.db as Db;
    const userId = mockState.user?.id as number;
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "slack.webhook",
      label: "Slack",
      target: "https://slack.test/check",
    });
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await postReminderEndpointTest(
      buildRequest(`/api/reminders/endpoints/${endpoint.id}/test`, {
        method: "POST",
        body: { body: "API test" },
      }),
      { params: Promise.resolve({ id: String(endpoint.id) }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, providerMessageId: null });
    expect(getReminderEndpoint(db, userId, endpoint.id)?.lastTestStatus).toBe(
      "ok",
    );
  });
});

describe("/api/tasks/[id]/reminders", () => {
  it("lists reminders for a single owned task", async () => {
    const db = mockState.db as Db;
    const userId = mockState.user?.id as number;
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "sms.twilio",
      label: "Phone",
      target: "+15125550103",
    });
    const task = createTask(db, userId, { description: "Task A" });
    const otherTask = createTask(db, userId, { description: "Task B" });
    const reminder = createTaskReminder(db, userId, {
      taskId: task.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: -15,
    });

    createTaskReminder(db, userId, {
      taskId: otherTask.id,
      endpointId: endpoint.id,
      anchor: "start",
      offsetMinutes: 0,
    });

    const response = await listTaskRemindersRoute(
      buildRequest(`/api/tasks/${task.id}/reminders`),
      { params: Promise.resolve({ id: String(task.id) }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: reminder.id,
      taskId: task.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: -15,
    });
  });

  it("creates a reminder for an owned task and endpoint", async () => {
    const db = mockState.db as Db;
    const userId = mockState.user?.id as number;
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "signal.signal_cli",
      label: "Signal",
      target: "+15125550104",
    });
    const task = createTask(db, userId, { description: "Task with reminder" });

    const response = await createTaskReminderRoute(
      buildRequest(`/api/tasks/${task.id}/reminders`, {
        method: "POST",
        body: {
          endpointId: endpoint.id,
          anchor: "start",
          offsetMinutes: 10,
          allDayLocalTime: "08:30",
          enabled: 0,
        },
      }),
      { params: Promise.resolve({ id: String(task.id) }) },
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      taskId: task.id,
      endpointId: endpoint.id,
      anchor: "start",
      offsetMinutes: 10,
      allDayLocalTime: "08:30",
      enabled: 0,
    });
    expect(getTaskReminder(db, userId, body.id)?.endpointId).toBe(endpoint.id);
  });

  it("rejects creating a reminder with another user's endpoint", async () => {
    const db = mockState.db as Db;
    const userId = mockState.user?.id as number;
    const otherUser = createTestUser(db);
    const endpoint = createReminderEndpoint(db, otherUser.id, {
      adapterKey: "slack.webhook",
      label: "Other webhook",
      target: "https://slack.test/other",
    });
    const task = createTask(db, userId, { description: "Task" });

    const response = await createTaskReminderRoute(
      buildRequest(`/api/tasks/${task.id}/reminders`, {
        method: "POST",
        body: {
          endpointId: endpoint.id,
          anchor: "due",
          offsetMinutes: -5,
        },
      }),
      { params: Promise.resolve({ id: String(task.id) }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Reminder endpoint not found",
    });
  });
});

describe("/api/tasks/[id]/reminders/[reminderId]", () => {
  it("updates a task reminder scoped to its task", async () => {
    const db = mockState.db as Db;
    const userId = mockState.user?.id as number;
    const endpointA = createReminderEndpoint(db, userId, {
      adapterKey: "sms.twilio",
      label: "Phone A",
      target: "+15125550105",
    });
    const endpointB = createReminderEndpoint(db, userId, {
      adapterKey: "telegram.bot_api",
      label: "Phone B",
      target: "456",
    });
    const task = createTask(db, userId, { description: "Scoped task" });
    const reminder = createTaskReminder(db, userId, {
      taskId: task.id,
      endpointId: endpointA.id,
      anchor: "due",
      offsetMinutes: -20,
    });

    const response = await patchTaskReminderRoute(
      buildRequest(`/api/tasks/${task.id}/reminders/${reminder.id}`, {
        method: "PATCH",
        body: {
          endpointId: endpointB.id,
          anchor: "start",
          offsetMinutes: 15,
          allDayLocalTime: null,
          enabled: 0,
        },
      }),
      {
        params: Promise.resolve({
          id: String(task.id),
          reminderId: String(reminder.id),
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: reminder.id,
      taskId: task.id,
      endpointId: endpointB.id,
      anchor: "start",
      offsetMinutes: 15,
      allDayLocalTime: null,
      enabled: 0,
    });
  });

  it("deletes a task reminder", async () => {
    const db = mockState.db as Db;
    const userId = mockState.user?.id as number;
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "discord.webhook",
      label: "Discord",
      target: "https://discord.test/delete",
    });
    const task = createTask(db, userId, {
      description: "Delete reminder task",
    });
    const reminder = createTaskReminder(db, userId, {
      taskId: task.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: -30,
    });

    const response = await deleteTaskReminderRoute(
      buildRequest(`/api/tasks/${task.id}/reminders/${reminder.id}`, {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({
          id: String(task.id),
          reminderId: String(reminder.id),
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(listTaskReminders(db, userId, task.id)).toHaveLength(0);
  });

  it("returns 404 when the reminder is not attached to the task path", async () => {
    const db = mockState.db as Db;
    const userId = mockState.user?.id as number;
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "sms.twilio",
      label: "Phone",
      target: "+15125550106",
    });
    const taskA = createTask(db, userId, { description: "Task A" });
    const taskB = createTask(db, userId, { description: "Task B" });
    const reminder = createTaskReminder(db, userId, {
      taskId: taskA.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: -5,
    });

    const response = await patchTaskReminderRoute(
      buildRequest(`/api/tasks/${taskB.id}/reminders/${reminder.id}`, {
        method: "PATCH",
        body: { offsetMinutes: 0 },
      }),
      {
        params: Promise.resolve({
          id: String(taskB.id),
          reminderId: String(reminder.id),
        }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Task reminder not found" });
  });
});
