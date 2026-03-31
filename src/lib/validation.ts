import type {
  CreateTaskInput,
  TaskStatus,
  UpdateTaskInput,
} from "@/core/types";
import { TASK_STATUSES } from "@/core/types";

interface ValidationError {
  field: string;
  message: string;
}

interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

function isValidIsoDate(value: string): boolean {
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.toISOString() === value;
}

function isValidTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function sanitize(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}

export function validateCreateTask(
  body: unknown,
): ValidationResult<CreateTaskInput> {
  const errors: ValidationError[] = [];

  if (typeof body !== "object" || body === null) {
    return {
      success: false,
      errors: [{ field: "body", message: "Request body must be an object" }],
    };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.description !== "string" || b.description.trim().length === 0) {
    errors.push({
      field: "description",
      message: "description is required and must be a non-empty string",
    });
  }

  if (b.status !== undefined) {
    if (!TASK_STATUSES.includes(b.status as TaskStatus)) {
      errors.push({
        field: "status",
        message: `status must be one of: ${TASK_STATUSES.join(", ")}`,
      });
    }
  }

  if (b.due !== undefined && b.due !== null) {
    if (typeof b.due !== "string" || !isValidIsoDate(b.due)) {
      errors.push({
        field: "due",
        message: "due must be a valid ISO 8601 date string or null",
      });
    }
  }

  if (b.startAt !== undefined && b.startAt !== null) {
    if (typeof b.startAt !== "string" || !isValidIsoDate(b.startAt)) {
      errors.push({
        field: "startAt",
        message: "startAt must be a valid ISO 8601 date string",
      });
    }
  }
  if (b.endAt !== undefined && b.endAt !== null) {
    if (typeof b.endAt !== "string" || !isValidIsoDate(b.endAt)) {
      errors.push({
        field: "endAt",
        message: "endAt must be a valid ISO 8601 date string",
      });
    }
  }
  if (
    typeof b.startAt === "string" &&
    isValidIsoDate(b.startAt) &&
    typeof b.endAt === "string" &&
    isValidIsoDate(b.endAt) &&
    new Date(b.endAt).getTime() <= new Date(b.startAt).getTime()
  ) {
    errors.push({ field: "endAt", message: "endAt must be after startAt" });
  }
  if (
    b.allDay !== undefined &&
    b.allDay !== null &&
    b.allDay !== 0 &&
    b.allDay !== 1
  ) {
    errors.push({ field: "allDay", message: "allDay must be 0 or 1" });
  }
  if (
    b.timezone !== undefined &&
    b.timezone !== null &&
    (typeof b.timezone !== "string" || !isValidTimezone(b.timezone))
  ) {
    errors.push({
      field: "timezone",
      message: "timezone must be a valid IANA timezone string",
    });
  }

  if (b.location !== undefined && b.location !== null) {
    if (typeof b.location !== "string" || b.location.trim().length > 500) {
      errors.push({
        field: "location",
        message: "location must be a string of at most 500 characters",
      });
    }
  }

  if (b.meetingUrl !== undefined && b.meetingUrl !== null) {
    if (typeof b.meetingUrl !== "string") {
      errors.push({
        field: "meetingUrl",
        message: "meetingUrl must be a string",
      });
    } else if (b.meetingUrl.trim().length > 2000) {
      errors.push({
        field: "meetingUrl",
        message: "meetingUrl must be at most 2000 characters",
      });
    } else if (!/^https?:\/\//i.test(b.meetingUrl.trim())) {
      errors.push({
        field: "meetingUrl",
        message:
          "meetingUrl must be a valid URL starting with http:// or https://",
      });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const data: CreateTaskInput = {
    description: sanitize((b.description as string).trim()),
  };

  if (b.status !== undefined) data.status = b.status as TaskStatus;
  if (b.due !== undefined && b.due !== null) data.due = b.due as string;
  if (b.notes !== undefined && b.notes !== null) {
    data.notes = sanitize(String(b.notes));
  }
  if (b.category !== undefined) data.category = b.category as string;
  if (b.recurrence !== undefined) data.recurrence = b.recurrence as string;
  if (b.recurMode !== undefined)
    data.recurMode = b.recurMode as CreateTaskInput["recurMode"];
  if (b.order !== undefined) data.order = b.order as number;
  if (b.startAt !== undefined && b.startAt !== null)
    data.startAt = b.startAt as string;
  if (b.endAt !== undefined && b.endAt !== null) data.endAt = b.endAt as string;
  if (b.allDay !== undefined && b.allDay !== null)
    data.allDay = b.allDay as number;
  if (b.timezone !== undefined && b.timezone !== null)
    data.timezone = b.timezone as string;
  if (b.location !== undefined && b.location !== null)
    data.location = sanitize(String(b.location).trim());
  if (b.meetingUrl !== undefined && b.meetingUrl !== null)
    data.meetingUrl = String(b.meetingUrl).trim();

  return { success: true, data };
}

export function validateUpdateTask(
  body: unknown,
): ValidationResult<UpdateTaskInput> {
  const errors: ValidationError[] = [];

  if (typeof body !== "object" || body === null) {
    return {
      success: false,
      errors: [{ field: "body", message: "Request body must be an object" }],
    };
  }

  const b = body as Record<string, unknown>;

  if (b.description !== undefined) {
    if (
      typeof b.description !== "string" ||
      b.description.trim().length === 0
    ) {
      errors.push({
        field: "description",
        message: "description must be a non-empty string",
      });
    }
  }

  if (b.status !== undefined) {
    if (!TASK_STATUSES.includes(b.status as TaskStatus)) {
      errors.push({
        field: "status",
        message: `status must be one of: ${TASK_STATUSES.join(", ")}`,
      });
    }
  }

  if (b.due !== undefined && b.due !== null) {
    if (typeof b.due !== "string" || !isValidIsoDate(b.due)) {
      errors.push({
        field: "due",
        message: "due must be a valid ISO 8601 date string or null",
      });
    }
  }

  if (b.startAt !== undefined && b.startAt !== null) {
    if (typeof b.startAt !== "string" || !isValidIsoDate(b.startAt)) {
      errors.push({
        field: "startAt",
        message: "startAt must be a valid ISO 8601 date string",
      });
    }
  }
  if (b.endAt !== undefined && b.endAt !== null) {
    if (typeof b.endAt !== "string" || !isValidIsoDate(b.endAt)) {
      errors.push({
        field: "endAt",
        message: "endAt must be a valid ISO 8601 date string",
      });
    }
  }
  if (
    typeof b.startAt === "string" &&
    isValidIsoDate(b.startAt) &&
    typeof b.endAt === "string" &&
    isValidIsoDate(b.endAt) &&
    new Date(b.endAt).getTime() <= new Date(b.startAt).getTime()
  ) {
    errors.push({ field: "endAt", message: "endAt must be after startAt" });
  }
  if (
    b.allDay !== undefined &&
    b.allDay !== null &&
    b.allDay !== 0 &&
    b.allDay !== 1
  ) {
    errors.push({ field: "allDay", message: "allDay must be 0 or 1" });
  }
  if (
    b.timezone !== undefined &&
    b.timezone !== null &&
    (typeof b.timezone !== "string" || !isValidTimezone(b.timezone))
  ) {
    errors.push({
      field: "timezone",
      message: "timezone must be a valid IANA timezone string",
    });
  }

  if (b.location !== undefined && b.location !== null) {
    if (typeof b.location !== "string" || b.location.trim().length > 500) {
      errors.push({
        field: "location",
        message: "location must be a string of at most 500 characters",
      });
    }
  }

  if (b.meetingUrl !== undefined && b.meetingUrl !== null) {
    if (typeof b.meetingUrl !== "string") {
      errors.push({
        field: "meetingUrl",
        message: "meetingUrl must be a string",
      });
    } else if (b.meetingUrl.trim().length > 2000) {
      errors.push({
        field: "meetingUrl",
        message: "meetingUrl must be at most 2000 characters",
      });
    } else if (!/^https?:\/\//i.test(b.meetingUrl.trim())) {
      errors.push({
        field: "meetingUrl",
        message:
          "meetingUrl must be a valid URL starting with http:// or https://",
      });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const data: UpdateTaskInput = {};

  if (b.description !== undefined) {
    data.description = sanitize((b.description as string).trim());
  }
  if (b.status !== undefined) data.status = b.status as TaskStatus;
  if (b.due !== undefined) data.due = b.due as string | null;
  if (b.notes !== undefined) {
    data.notes = b.notes === null ? null : sanitize(String(b.notes));
  }
  if (b.category !== undefined) data.category = b.category as string | null;
  if (b.recurrence !== undefined)
    data.recurrence = b.recurrence as string | null;
  if (b.recurMode !== undefined)
    data.recurMode = b.recurMode as UpdateTaskInput["recurMode"];
  if (b.order !== undefined) data.order = b.order as number;
  if (b.startAt !== undefined) data.startAt = b.startAt as string | null;
  if (b.endAt !== undefined) data.endAt = b.endAt as string | null;
  if (b.allDay !== undefined) data.allDay = b.allDay as number | null;
  if (b.timezone !== undefined) data.timezone = b.timezone as string | null;
  if (b.location !== undefined)
    data.location =
      b.location === null ? null : sanitize(String(b.location).trim());
  if (b.meetingUrl !== undefined)
    data.meetingUrl =
      b.meetingUrl === null ? null : String(b.meetingUrl).trim();

  return { success: true, data };
}
