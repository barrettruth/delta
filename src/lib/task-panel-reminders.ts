import type { ReminderEndpointRecord } from "@/core/reminders/endpoints";
import type { ReminderAnchor, TaskReminder } from "@/core/reminders/types";
import { getReminderChannelLabel } from "./reminder-endpoint-form";

export interface TaskPanelReminderDraft {
  clientId: string;
  id: number | null;
  endpointId: number | null;
  anchor: ReminderAnchor;
  offsetMinutes: number;
  allDayLocalTime: string | null;
  enabled: 0 | 1;
}

export type ReminderOffsetDirection = "before" | "after" | "at";

type TaskPanelReminderFields = Omit<TaskPanelReminderDraft, "clientId">;

export function createTaskPanelReminderDraft(
  clientId: string,
  input: {
    endpointId: number | null;
    anchor: ReminderAnchor;
    allDay: boolean;
  },
): TaskPanelReminderDraft {
  return {
    clientId,
    id: null,
    endpointId: input.endpointId,
    anchor: input.anchor,
    offsetMinutes: input.allDay ? 0 : -15,
    allDayLocalTime: input.allDay ? "09:00" : null,
    enabled: 1,
  };
}

export function taskReminderToDraft(
  reminder: Pick<
    TaskReminder,
    | "id"
    | "endpointId"
    | "anchor"
    | "offsetMinutes"
    | "allDayLocalTime"
    | "enabled"
  >,
  clientId: string,
): TaskPanelReminderDraft {
  return {
    clientId,
    id: reminder.id,
    endpointId: reminder.endpointId,
    anchor: reminder.anchor,
    offsetMinutes: reminder.offsetMinutes,
    allDayLocalTime: reminder.allDayLocalTime,
    enabled: reminder.enabled === 1 ? 1 : 0,
  };
}

export function getReminderOffsetDirection(
  offsetMinutes: number,
): ReminderOffsetDirection {
  if (offsetMinutes < 0) return "before";
  if (offsetMinutes > 0) return "after";
  return "at";
}

export function getReminderOffsetMagnitude(offsetMinutes: number): number {
  return Math.abs(offsetMinutes);
}

export function buildReminderOffsetMinutes(
  direction: ReminderOffsetDirection,
  magnitude: number,
): number {
  const normalized = Math.max(
    0,
    Math.floor(Number.isFinite(magnitude) ? magnitude : 0),
  );
  if (direction === "before") return normalized * -1;
  if (direction === "after") return normalized;
  return 0;
}

export function taskPanelRemindersEqual(
  a: TaskPanelReminderFields,
  b: TaskPanelReminderFields,
): boolean {
  return (
    a.id === b.id &&
    a.endpointId === b.endpointId &&
    a.anchor === b.anchor &&
    a.offsetMinutes === b.offsetMinutes &&
    a.allDayLocalTime === b.allDayLocalTime &&
    a.enabled === b.enabled
  );
}

function formatReminderDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

  return parts.join(" ");
}

export function formatTaskPanelReminderSummary(
  reminder: Pick<
    TaskPanelReminderDraft,
    "endpointId" | "anchor" | "offsetMinutes" | "allDayLocalTime"
  >,
  endpoints: Map<
    number,
    Pick<ReminderEndpointRecord, "id" | "adapterKey" | "label">
  >,
  options: { allDay: boolean },
): string {
  const endpointLabel =
    (reminder.endpointId !== null
      ? (() => {
          const endpoint = endpoints.get(reminder.endpointId);
          return endpoint ? getReminderChannelLabel(endpoint.adapterKey) : null;
        })()
      : null) ?? "unknown endpoint";

  if (options.allDay && reminder.allDayLocalTime) {
    if (reminder.offsetMinutes === 0) {
      return `${reminder.allDayLocalTime} on ${reminder.anchor} day → ${endpointLabel}`;
    }

    return `${reminder.allDayLocalTime}, ${formatReminderDuration(
      Math.abs(reminder.offsetMinutes),
    )} ${reminder.offsetMinutes < 0 ? "before" : "after"} ${
      reminder.anchor
    } → ${endpointLabel}`;
  }

  if (reminder.offsetMinutes === 0) {
    return `at ${reminder.anchor} → ${endpointLabel}`;
  }

  return `${formatReminderDuration(Math.abs(reminder.offsetMinutes))} ${
    reminder.offsetMinutes < 0 ? "before" : "after"
  } ${reminder.anchor} → ${endpointLabel}`;
}
