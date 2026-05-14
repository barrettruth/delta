import type { Task } from "@/core/types";
import type { GoogleTasksMappedSnapshot, GoogleTasksMappedTask } from "./types";

type GoogleTasksMappedField =
  | "description"
  | "notes"
  | "due"
  | "status"
  | "category";

const MAPPED_FIELDS: GoogleTasksMappedField[] = [
  "description",
  "notes",
  "due",
  "status",
  "category",
];

type FieldValue =
  | string
  | null
  | { status: string; completedAt: string | null };

export interface ParsedGoogleTasksLinkMetadata {
  metadata: Record<string, unknown>;
  appliedSnapshot: GoogleTasksMappedSnapshot | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isTaskStatus(
  value: unknown,
): value is GoogleTasksMappedSnapshot["status"] {
  return (
    value === "pending" ||
    value === "done" ||
    value === "wip" ||
    value === "blocked" ||
    value === "cancelled"
  );
}

export function normalizeGoogleTasksSnapshot(
  value: unknown,
): GoogleTasksMappedSnapshot | null {
  if (!isRecord(value)) return null;
  if (typeof value.description !== "string") return null;
  if (!isTaskStatus(value.status)) return null;

  return {
    description: value.description,
    notes: stringOrNull(value.notes),
    due: stringOrNull(value.due),
    status: value.status,
    completedAt: stringOrNull(value.completedAt),
    category: stringOrNull(value.category),
  };
}

export function parseGoogleTasksLinkMetadata(
  value: string | null,
): ParsedGoogleTasksLinkMetadata {
  if (!value) {
    return {
      metadata: {},
      appliedSnapshot: null,
    };
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) {
      return {
        metadata: {},
        appliedSnapshot: null,
      };
    }
    return {
      metadata: parsed,
      appliedSnapshot: normalizeGoogleTasksSnapshot(parsed.appliedSnapshot),
    };
  } catch {
    return {
      metadata: {},
      appliedSnapshot: null,
    };
  }
}

export function snapshotFromGoogleTask(
  mapped: GoogleTasksMappedTask,
): GoogleTasksMappedSnapshot {
  return {
    description: mapped.input.description,
    notes: mapped.input.notes ?? null,
    due: mapped.input.due ?? null,
    status: mapped.input.status,
    completedAt: mapped.input.completedAt ?? null,
    category: mapped.input.category ?? null,
  };
}

export function snapshotFromDeltaTask(task: Task): GoogleTasksMappedSnapshot {
  return {
    description: task.description,
    notes: task.notes ?? null,
    due: task.due ?? null,
    status: task.status,
    completedAt: task.completedAt ?? null,
    category: task.category ?? null,
  };
}

function valueFor(
  snapshot: GoogleTasksMappedSnapshot,
  field: GoogleTasksMappedField,
): FieldValue {
  if (field === "status") {
    return {
      status: snapshot.status,
      completedAt: snapshot.completedAt,
    };
  }
  return snapshot[field];
}

function valuesEqual(a: FieldValue, b: FieldValue): boolean {
  if (isRecord(a) || isRecord(b)) {
    return (
      isRecord(a) &&
      isRecord(b) &&
      a.status === b.status &&
      a.completedAt === b.completedAt
    );
  }
  return a === b;
}

export function changedGoogleTasksFields(
  a: GoogleTasksMappedSnapshot,
  b: GoogleTasksMappedSnapshot,
): GoogleTasksMappedField[] {
  return MAPPED_FIELDS.filter(
    (field) => !valuesEqual(valueFor(a, field), valueFor(b, field)),
  );
}
