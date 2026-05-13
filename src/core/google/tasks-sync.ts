import type { Task, UpdateTaskInput } from "@/core/types";
import type {
  GoogleTasksMappedField,
  GoogleTasksMappedSnapshot,
  GoogleTasksMappedTask,
  GoogleTasksSyncState,
} from "./types";

const MAPPED_FIELDS: GoogleTasksMappedField[] = [
  "description",
  "notes",
  "due",
  "status",
  "category",
];

const SYNC_STATES: GoogleTasksSyncState[] = [
  "clean",
  "local_modified",
  "remote_outdated",
  "conflict",
];

type FieldValue =
  | string
  | null
  | { status: string; completedAt: string | null };

export interface ParsedGoogleTasksLinkMetadata {
  metadata: Record<string, unknown>;
  appliedSnapshot: GoogleTasksMappedSnapshot | null;
  remoteSnapshot: GoogleTasksMappedSnapshot | null;
  syncState: GoogleTasksSyncState | null;
}

export interface GoogleTasksMergeResult {
  patch: UpdateTaskInput;
  appliedSnapshot: GoogleTasksMappedSnapshot;
  remoteSnapshot: GoogleTasksMappedSnapshot | null;
  syncState: GoogleTasksSyncState;
  changedFields: GoogleTasksMappedField[];
  appliedRemote: boolean;
  appliedCancellation: boolean;
  deletedProtected: boolean;
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
      remoteSnapshot: null,
      syncState: null,
    };
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) {
      return {
        metadata: {},
        appliedSnapshot: null,
        remoteSnapshot: null,
        syncState: null,
      };
    }
    const syncState =
      typeof parsed.syncState === "string" &&
      SYNC_STATES.includes(parsed.syncState as GoogleTasksSyncState)
        ? (parsed.syncState as GoogleTasksSyncState)
        : null;
    return {
      metadata: parsed,
      appliedSnapshot: normalizeGoogleTasksSnapshot(parsed.appliedSnapshot),
      remoteSnapshot: normalizeGoogleTasksSnapshot(parsed.remoteSnapshot),
      syncState,
    };
  } catch {
    return {
      metadata: {},
      appliedSnapshot: null,
      remoteSnapshot: null,
      syncState: null,
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

function assignField(
  target: GoogleTasksMappedSnapshot,
  source: GoogleTasksMappedSnapshot,
  field: GoogleTasksMappedField,
): void {
  if (field === "status") {
    target.status = source.status;
    target.completedAt = source.completedAt;
    return;
  }
  target[field] = source[field] as never;
}

function addPatchField(
  patch: UpdateTaskInput,
  source: GoogleTasksMappedSnapshot,
  field: GoogleTasksMappedField,
): void {
  if (field === "status") {
    patch.status = source.status;
    patch.completedAt = source.completedAt;
    return;
  }
  if (field === "description") patch.description = source.description;
  else if (field === "notes") patch.notes = source.notes;
  else if (field === "due") patch.due = source.due;
  else if (field === "category") patch.category = source.category;
}

function wouldClearRecurringAnchor(
  task: Task,
  field: GoogleTasksMappedField,
  remote: GoogleTasksMappedSnapshot,
): boolean {
  return (
    field === "due" &&
    remote.due === null &&
    Boolean(task.recurrence) &&
    !task.startAt
  );
}

function aggregateState({
  conflictFields,
  deletedProtected,
  localFields,
  remoteOutdatedFields,
}: {
  conflictFields: Set<GoogleTasksMappedField>;
  deletedProtected: boolean;
  localFields: Set<GoogleTasksMappedField>;
  remoteOutdatedFields: Set<GoogleTasksMappedField>;
}): GoogleTasksSyncState {
  if (conflictFields.size > 0) return "conflict";
  if (deletedProtected || remoteOutdatedFields.size > 0) {
    return "remote_outdated";
  }
  if (localFields.size > 0) return "local_modified";
  return "clean";
}

export function mergeGoogleTasksSnapshots({
  base,
  local,
  remote,
  remoteDeleted,
  task,
}: {
  base: GoogleTasksMappedSnapshot;
  local: GoogleTasksMappedSnapshot;
  remote: GoogleTasksMappedSnapshot;
  remoteDeleted: boolean;
  task: Task;
}): GoogleTasksMergeResult {
  const patch: UpdateTaskInput = {};
  const appliedSnapshot: GoogleTasksMappedSnapshot = { ...base };
  const localFields = new Set<GoogleTasksMappedField>();
  const conflictFields = new Set<GoogleTasksMappedField>();
  const remoteOutdatedFields = new Set<GoogleTasksMappedField>();
  let appliedRemote = false;
  let appliedCancellation = false;

  const locallyChangedFields = MAPPED_FIELDS.filter((field) => {
    return !valuesEqual(valueFor(local, field), valueFor(base, field));
  });

  if (remoteDeleted && locallyChangedFields.length > 0) {
    const changedFields = new Set<GoogleTasksMappedField>([
      ...locallyChangedFields,
      "status",
    ]);
    return {
      patch,
      appliedSnapshot,
      remoteSnapshot: remote,
      syncState: locallyChangedFields.includes("status")
        ? "conflict"
        : "remote_outdated",
      changedFields: Array.from(changedFields),
      appliedRemote: false,
      appliedCancellation: false,
      deletedProtected: true,
    };
  }

  if (remoteDeleted) {
    return {
      patch: {
        status: remote.status,
        completedAt: remote.completedAt,
      },
      appliedSnapshot: {
        ...base,
        status: remote.status,
        completedAt: remote.completedAt,
      },
      remoteSnapshot: null,
      syncState: "clean",
      changedFields: [],
      appliedRemote: true,
      appliedCancellation: remote.status === "cancelled",
      deletedProtected: false,
    };
  }

  for (const field of MAPPED_FIELDS) {
    const baseValue = valueFor(base, field);
    const localValue = valueFor(local, field);
    const remoteValue = valueFor(remote, field);
    const localChanged = !valuesEqual(localValue, baseValue);
    const remoteChanged = !valuesEqual(remoteValue, baseValue);

    if (!localChanged && !remoteChanged) {
      assignField(appliedSnapshot, base, field);
      continue;
    }

    if (!localChanged && remoteChanged) {
      if (wouldClearRecurringAnchor(task, field, remote)) {
        remoteOutdatedFields.add(field);
        continue;
      }
      addPatchField(patch, remote, field);
      assignField(appliedSnapshot, remote, field);
      appliedRemote = true;
      if (field === "status" && remote.status === "cancelled") {
        appliedCancellation = true;
      }
      continue;
    }

    if (localChanged && !remoteChanged) {
      localFields.add(field);
      assignField(appliedSnapshot, base, field);
      continue;
    }

    if (valuesEqual(localValue, remoteValue)) {
      assignField(appliedSnapshot, remote, field);
      continue;
    }

    conflictFields.add(field);
    assignField(appliedSnapshot, base, field);
  }

  const syncState = aggregateState({
    conflictFields,
    deletedProtected: false,
    localFields,
    remoteOutdatedFields,
  });
  const changedFields = new Set<GoogleTasksMappedField>([
    ...Array.from(localFields),
    ...Array.from(conflictFields),
    ...Array.from(remoteOutdatedFields),
  ]);

  return {
    patch,
    appliedSnapshot,
    remoteSnapshot: syncState === "clean" ? null : remote,
    syncState,
    changedFields: Array.from(changedFields),
    appliedRemote,
    appliedCancellation,
    deletedProtected: false,
  };
}

export function hasTaskPatch(input: UpdateTaskInput): boolean {
  return Object.keys(input).length > 0;
}

export function changedGoogleTasksFields(
  a: GoogleTasksMappedSnapshot,
  b: GoogleTasksMappedSnapshot,
): GoogleTasksMappedField[] {
  return MAPPED_FIELDS.filter(
    (field) => !valuesEqual(valueFor(a, field), valueFor(b, field)),
  );
}
