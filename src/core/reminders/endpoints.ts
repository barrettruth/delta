import { and, eq } from "drizzle-orm";
import { decrypt, encrypt, getEncryptionKey } from "@/core/encryption";
import { reminderEndpoints } from "@/db/schema";
import type { Db } from "../types";
import {
  isReminderAdapterKey,
  type ReminderAdapterKey,
  type ReminderTestStatus,
} from "./types";

export interface ReminderEndpointRecord {
  id: number;
  userId: number;
  adapterKey: ReminderAdapterKey;
  label: string;
  target: string;
  metadata: Record<string, unknown> | null;
  enabled: number;
  lastTestAt: string | null;
  lastTestStatus: ReminderTestStatus | null;
  lastTestError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderEndpointInput {
  adapterKey: ReminderAdapterKey;
  label: string;
  target: string;
  metadata?: Record<string, unknown>;
  enabled?: number;
}

export interface UpdateReminderEndpointInput {
  label?: string;
  target?: string;
  metadata?: Record<string, unknown> | null;
  enabled?: number;
}

function mapEndpoint(
  row: typeof reminderEndpoints.$inferSelect,
): ReminderEndpointRecord | null {
  if (!isReminderAdapterKey(row.adapterKey)) {
    return null;
  }

  const key = getEncryptionKey();

  return {
    id: row.id,
    userId: row.userId,
    adapterKey: row.adapterKey,
    label: row.label,
    target: decrypt(row.encryptedTarget, key),
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    enabled: row.enabled,
    lastTestAt: row.lastTestAt,
    lastTestStatus: row.lastTestStatus,
    lastTestError: row.lastTestError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createReminderEndpoint(
  db: Db,
  userId: number,
  input: CreateReminderEndpointInput,
): ReminderEndpointRecord {
  const key = getEncryptionKey();
  const now = new Date().toISOString();

  const row = db
    .insert(reminderEndpoints)
    .values({
      userId,
      adapterKey: input.adapterKey,
      label: input.label,
      encryptedTarget: encrypt(input.target, key),
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      enabled: input.enabled ?? 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  const endpoint = mapEndpoint(row);
  if (!endpoint) {
    throw new Error(`Reminder adapter ${row.adapterKey} is not supported`);
  }

  return endpoint;
}

export function getReminderEndpoint(
  db: Db,
  userId: number,
  id: number,
): ReminderEndpointRecord | null {
  const row = db
    .select()
    .from(reminderEndpoints)
    .where(
      and(eq(reminderEndpoints.userId, userId), eq(reminderEndpoints.id, id)),
    )
    .get();

  return row ? mapEndpoint(row) : null;
}

export function listReminderEndpoints(
  db: Db,
  userId: number,
): ReminderEndpointRecord[] {
  return db
    .select()
    .from(reminderEndpoints)
    .where(eq(reminderEndpoints.userId, userId))
    .all()
    .flatMap((row) => {
      const endpoint = mapEndpoint(row);
      return endpoint ? [endpoint] : [];
    });
}

export function updateReminderEndpoint(
  db: Db,
  userId: number,
  id: number,
  input: UpdateReminderEndpointInput,
): ReminderEndpointRecord | null {
  const existing = db
    .select()
    .from(reminderEndpoints)
    .where(
      and(eq(reminderEndpoints.userId, userId), eq(reminderEndpoints.id, id)),
    )
    .get();

  if (!existing) return null;

  const key = getEncryptionKey();
  const row = db
    .update(reminderEndpoints)
    .set({
      label: input.label ?? existing.label,
      encryptedTarget:
        input.target !== undefined
          ? encrypt(input.target, key)
          : existing.encryptedTarget,
      metadata:
        input.metadata === undefined
          ? existing.metadata
          : input.metadata === null
            ? null
            : JSON.stringify(input.metadata),
      enabled: input.enabled ?? existing.enabled,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(reminderEndpoints.id, existing.id))
    .returning()
    .get();

  return mapEndpoint(row);
}

export function setReminderEndpointTestResult(
  db: Db,
  userId: number,
  id: number,
  status: ReminderTestStatus,
  error?: string | null,
): ReminderEndpointRecord | null {
  const existing = db
    .select()
    .from(reminderEndpoints)
    .where(
      and(eq(reminderEndpoints.userId, userId), eq(reminderEndpoints.id, id)),
    )
    .get();

  if (!existing) return null;

  const row = db
    .update(reminderEndpoints)
    .set({
      lastTestAt: new Date().toISOString(),
      lastTestStatus: status,
      lastTestError: error ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(reminderEndpoints.id, existing.id))
    .returning()
    .get();

  return mapEndpoint(row);
}

export function deleteReminderEndpoint(
  db: Db,
  userId: number,
  id: number,
): boolean {
  const result = db
    .delete(reminderEndpoints)
    .where(
      and(eq(reminderEndpoints.userId, userId), eq(reminderEndpoints.id, id)),
    )
    .run();

  return result.changes > 0;
}
