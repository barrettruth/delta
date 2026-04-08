import { eq } from "drizzle-orm";
import {
  reminderDeliveries,
  reminderEndpoints,
  taskReminders,
  tasks,
} from "@/db/schema";
import type { Db, Task } from "../types";
import {
  claimReminderDelivery,
  listDispatchableReminderDeliveries,
  markReminderDeliveryFailed,
  markReminderDeliverySent,
  markReminderDeliverySuppressed,
} from "./deliveries";
import {
  getReminderEndpoint,
  setReminderEndpointTestResult,
} from "./endpoints";
import { getReminderAdapterRuntime, ReminderAdapterError } from "./runtime";
import { isReminderAdapterKey, type ReminderDelivery } from "./types";

export interface ReminderEndpointTestResult {
  endpoint: NonNullable<ReturnType<typeof getReminderEndpoint>>;
  providerMessageId: string | null;
}

function timestamp(): string {
  return new Date().toISOString();
}

function renderReminderBody(
  task: Pick<Task, "description" | "due" | "startAt">,
): string {
  const lines = [`Reminder: ${task.description}`];

  if (task.due) {
    lines.push(`Due: ${task.due}`);
  } else if (task.startAt) {
    lines.push(`Starts: ${task.startAt}`);
  }

  return lines.join("\n");
}

function toDispatchError(error: unknown): ReminderAdapterError {
  if (error instanceof ReminderAdapterError) return error;
  if (error instanceof Error) return new ReminderAdapterError(error.message);
  return new ReminderAdapterError("Reminder dispatch failed");
}

function getReminderDispatchContext(db: Db, deliveryId: number) {
  return db
    .select({
      delivery: reminderDeliveries,
      endpoint: reminderEndpoints,
      reminder: taskReminders,
      task: tasks,
    })
    .from(reminderDeliveries)
    .innerJoin(
      reminderEndpoints,
      eq(reminderDeliveries.endpointId, reminderEndpoints.id),
    )
    .innerJoin(
      taskReminders,
      eq(reminderDeliveries.taskReminderId, taskReminders.id),
    )
    .innerJoin(tasks, eq(reminderDeliveries.taskId, tasks.id))
    .where(eq(reminderDeliveries.id, deliveryId))
    .get();
}

export async function dispatchReminderDelivery(
  db: Db,
  id: number,
  input: { nowIso?: string } = {},
): Promise<ReminderDelivery | null> {
  const nowIso = input.nowIso ?? timestamp();
  const claimed = claimReminderDelivery(db, id, nowIso);
  if (!claimed) return null;

  const context = getReminderDispatchContext(db, claimed.id);
  if (!context) {
    return markReminderDeliveryFailed(
      db,
      claimed.id,
      `Reminder delivery ${claimed.id} is missing dispatch context`,
    );
  }

  if (
    context.task.status === "done" ||
    context.task.status === "cancelled" ||
    context.endpoint.enabled !== 1 ||
    context.reminder.enabled !== 1
  ) {
    return markReminderDeliverySuppressed(db, claimed.id);
  }

  if (
    !isReminderAdapterKey(context.delivery.adapterKey) ||
    !isReminderAdapterKey(context.endpoint.adapterKey)
  ) {
    return markReminderDeliveryFailed(
      db,
      claimed.id,
      "Reminder adapter is no longer supported",
      false,
    );
  }

  const runtime = getReminderAdapterRuntime(context.delivery.adapterKey);
  if (!runtime) {
    return markReminderDeliveryFailed(
      db,
      claimed.id,
      "Reminder adapter is no longer supported",
      false,
    );
  }

  const renderedBody = renderReminderBody(context.task);

  try {
    const result = await runtime.send({
      db,
      endpoint: {
        id: context.endpoint.id,
        userId: context.endpoint.userId,
        adapterKey: context.endpoint.adapterKey,
        label: context.endpoint.label,
        target:
          getReminderEndpoint(db, context.endpoint.userId, context.endpoint.id)
            ?.target ?? "",
        metadata: context.endpoint.metadata
          ? JSON.parse(context.endpoint.metadata)
          : null,
        enabled: context.endpoint.enabled,
        lastTestAt: context.endpoint.lastTestAt,
        lastTestStatus: context.endpoint.lastTestStatus,
        lastTestError: context.endpoint.lastTestError,
        createdAt: context.endpoint.createdAt,
        updatedAt: context.endpoint.updatedAt,
      },
      body: renderedBody,
      delivery: context.delivery,
      reminder: context.reminder,
      task: context.task,
    });

    return markReminderDeliverySent(db, claimed.id, {
      providerMessageId: result?.providerMessageId ?? null,
      renderedBody,
    });
  } catch (error) {
    const dispatchError = toDispatchError(error);
    return markReminderDeliveryFailed(
      db,
      claimed.id,
      dispatchError.message,
      dispatchError.retryable,
    );
  }
}

export async function dispatchDueReminderDeliveries(
  db: Db,
  input: { nowIso?: string; limit?: number } = {},
): Promise<ReminderDelivery[]> {
  const nowIso = input.nowIso ?? timestamp();
  const deliveries = listDispatchableReminderDeliveries(
    db,
    nowIso,
    input.limit,
  );
  const dispatched: ReminderDelivery[] = [];

  for (const delivery of deliveries) {
    const result = await dispatchReminderDelivery(db, delivery.id, { nowIso });
    if (result) dispatched.push(result);
  }

  return dispatched;
}

export async function sendReminderEndpointTest(
  db: Db,
  userId: number,
  endpointId: number,
  input: { body?: string } = {},
): Promise<ReminderEndpointTestResult> {
  const endpoint = getReminderEndpoint(db, userId, endpointId);
  if (!endpoint) {
    throw new Error(`Reminder endpoint ${endpointId} not found`);
  }

  const runtime = getReminderAdapterRuntime(endpoint.adapterKey);
  if (!runtime) {
    const error = `Reminder adapter runtime is not available for ${endpoint.adapterKey}`;
    setReminderEndpointTestResult(db, userId, endpointId, "failed", error);
    throw new Error(error);
  }

  try {
    const result = await runtime.send({
      db,
      endpoint,
      body: input.body ?? "Test reminder from delta",
    });
    const updated = setReminderEndpointTestResult(db, userId, endpointId, "ok");
    if (!updated) {
      throw new Error(`Reminder endpoint ${endpointId} not found`);
    }
    return {
      endpoint: updated,
      providerMessageId: result?.providerMessageId ?? null,
    };
  } catch (error) {
    const dispatchError = toDispatchError(error);
    setReminderEndpointTestResult(
      db,
      userId,
      endpointId,
      "failed",
      dispatchError.message,
    );
    throw dispatchError;
  }
}
