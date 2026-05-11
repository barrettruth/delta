import type { UpdateTaskInput } from "@/core/types";
import { formatValidationErrors, parseUpdateTaskInput } from "@/lib/validation";

export interface TaskPanelFormValues {
  description: string;
  category: string;
  due: string;
  location: string;
  locationLat: number | null;
  locationLon: number | null;
  meetingUrl: string;
  recurrence: string | null;
  recurMode: "scheduled" | "completion";
  notes: string | null;
}

export function normalizeTaskPanelFormValues(
  values: TaskPanelFormValues,
): TaskPanelFormValues {
  return {
    ...values,
    description: values.description.trim(),
    location: values.location.trim(),
    meetingUrl: values.meetingUrl.trim(),
    recurrence: values.recurrence || null,
  };
}

export function buildTaskPanelUpdateInput(
  values: TaskPanelFormValues,
  initialDue: string,
): UpdateTaskInput {
  const normalized = normalizeTaskPanelFormValues(values);
  const input: UpdateTaskInput = {
    description: normalized.description,
    category: normalized.category || null,
    ...(normalized.due !== initialDue
      ? { due: normalized.due ? new Date(normalized.due).toISOString() : null }
      : {}),
    notes: normalized.notes || null,
    location: normalized.location || null,
    locationLat: normalized.location ? normalized.locationLat : null,
    locationLon: normalized.location ? normalized.locationLon : null,
    meetingUrl: normalized.meetingUrl || null,
    recurrence: normalized.recurrence || null,
    recurMode: normalized.recurrence ? normalized.recurMode : null,
  };
  const result = parseUpdateTaskInput(input);
  if (!result.success || !result.data) {
    throw new Error(formatValidationErrors(result.errors));
  }

  return result.data;
}

export function isTaskPanelDirty(
  initial: TaskPanelFormValues | null,
  current: TaskPanelFormValues,
): boolean {
  if (!initial) return false;

  const normalizedInitial = normalizeTaskPanelFormValues(initial);
  const normalizedCurrent = normalizeTaskPanelFormValues(current);

  return (
    normalizedInitial.description !== normalizedCurrent.description ||
    normalizedInitial.category !== normalizedCurrent.category ||
    normalizedInitial.due !== normalizedCurrent.due ||
    normalizedInitial.location !== normalizedCurrent.location ||
    normalizedInitial.locationLat !== normalizedCurrent.locationLat ||
    normalizedInitial.locationLon !== normalizedCurrent.locationLon ||
    normalizedInitial.meetingUrl !== normalizedCurrent.meetingUrl ||
    normalizedInitial.recurrence !== normalizedCurrent.recurrence ||
    normalizedInitial.recurMode !== normalizedCurrent.recurMode ||
    normalizedInitial.notes !== normalizedCurrent.notes
  );
}
