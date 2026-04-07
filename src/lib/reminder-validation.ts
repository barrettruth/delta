import type { ReminderDeliveryLogFilters } from "@/core/reminders/deliveries";
import type {
  CreateReminderEndpointInput,
  UpdateReminderEndpointInput,
} from "@/core/reminders/endpoints";
import type {
  CreateTaskReminderInput,
  UpdateTaskReminderInput,
} from "@/core/reminders/rules";
import {
  isReminderAdapterKey,
  isReminderAnchor,
  isReminderDeliveryStatus,
  REMINDER_DELIVERY_STATUSES,
} from "@/core/reminders/types";

interface ValidationError {
  field: string;
  message: string;
}

interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitize(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function isValidFlag(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
}

function isValidAllDayLocalTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function parsePositiveInteger(
  value: string | null,
  field: string,
  errors: ValidationError[],
): number | undefined {
  if (value === null) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.push({
      field,
      message: `${field} must be a positive integer`,
    });
    return undefined;
  }
  return parsed;
}

export function validateCreateReminderEndpoint(
  body: unknown,
): ValidationResult<CreateReminderEndpointInput> {
  if (!isRecord(body)) {
    return {
      success: false,
      errors: [{ field: "body", message: "Request body must be an object" }],
    };
  }

  const errors: ValidationError[] = [];

  if (
    typeof body.adapterKey !== "string" ||
    !isReminderAdapterKey(body.adapterKey)
  ) {
    errors.push({
      field: "adapterKey",
      message: "adapterKey must be a supported reminder adapter",
    });
  }

  if (
    typeof body.label !== "string" ||
    sanitize(body.label).trim().length === 0
  ) {
    errors.push({
      field: "label",
      message: "label is required and must be a non-empty string",
    });
  }

  if (typeof body.target !== "string" || body.target.trim().length === 0) {
    errors.push({
      field: "target",
      message: "target is required and must be a non-empty string",
    });
  }

  if (body.metadata !== undefined && !isRecord(body.metadata)) {
    errors.push({
      field: "metadata",
      message: "metadata must be an object",
    });
  }

  if (body.enabled !== undefined && !isValidFlag(body.enabled)) {
    errors.push({
      field: "enabled",
      message: "enabled must be 0 or 1",
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const data: CreateReminderEndpointInput = {
    adapterKey: body.adapterKey as CreateReminderEndpointInput["adapterKey"],
    label: sanitize((body.label as string).trim()),
    target: (body.target as string).trim(),
  };

  if (body.metadata !== undefined) {
    data.metadata = body.metadata as Record<string, unknown>;
  }
  if (body.enabled !== undefined) data.enabled = body.enabled as 0 | 1;

  return { success: true, data };
}

export function validateReminderDeliveryLogFilters(
  searchParams: URLSearchParams,
): ValidationResult<ReminderDeliveryLogFilters> {
  const errors: ValidationError[] = [];
  const taskId = parsePositiveInteger(
    searchParams.get("task_id"),
    "task_id",
    errors,
  );
  const endpointId = parsePositiveInteger(
    searchParams.get("endpoint_id"),
    "endpoint_id",
    errors,
  );
  const statusValue = searchParams.get("status");

  let status: ReminderDeliveryLogFilters["status"];
  if (statusValue !== null) {
    const values = statusValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (
      values.length === 0 ||
      values.some((value) => !isReminderDeliveryStatus(value))
    ) {
      errors.push({
        field: "status",
        message: `status must be one or more of: ${REMINDER_DELIVERY_STATUSES.join(", ")}`,
      });
    } else {
      status =
        values.length === 1
          ? (values[0] as ReminderDeliveryLogFilters["status"])
          : (values as ReminderDeliveryLogFilters["status"]);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const data: ReminderDeliveryLogFilters = {};

  if (taskId !== undefined) data.taskId = taskId;
  if (endpointId !== undefined) data.endpointId = endpointId;
  if (status !== undefined) data.status = status;

  return { success: true, data };
}

export function validateUpdateReminderEndpoint(
  body: unknown,
): ValidationResult<UpdateReminderEndpointInput> {
  if (!isRecord(body)) {
    return {
      success: false,
      errors: [{ field: "body", message: "Request body must be an object" }],
    };
  }

  const errors: ValidationError[] = [];

  if (
    body.label !== undefined &&
    (typeof body.label !== "string" || sanitize(body.label).trim().length === 0)
  ) {
    errors.push({
      field: "label",
      message: "label must be a non-empty string",
    });
  }

  if (
    body.target !== undefined &&
    (typeof body.target !== "string" || body.target.trim().length === 0)
  ) {
    errors.push({
      field: "target",
      message: "target must be a non-empty string",
    });
  }

  if (
    body.metadata !== undefined &&
    body.metadata !== null &&
    !isRecord(body.metadata)
  ) {
    errors.push({
      field: "metadata",
      message: "metadata must be an object or null",
    });
  }

  if (body.enabled !== undefined && !isValidFlag(body.enabled)) {
    errors.push({
      field: "enabled",
      message: "enabled must be 0 or 1",
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const data: UpdateReminderEndpointInput = {};

  if (body.label !== undefined) {
    data.label = sanitize((body.label as string).trim());
  }
  if (body.target !== undefined) {
    data.target = (body.target as string).trim();
  }
  if (body.metadata !== undefined) {
    data.metadata = body.metadata as Record<string, unknown> | null;
  }
  if (body.enabled !== undefined) {
    data.enabled = body.enabled as 0 | 1;
  }

  return { success: true, data };
}

export function validateCreateTaskReminder(
  body: unknown,
): ValidationResult<Omit<CreateTaskReminderInput, "taskId">> {
  if (!isRecord(body)) {
    return {
      success: false,
      errors: [{ field: "body", message: "Request body must be an object" }],
    };
  }

  const errors: ValidationError[] = [];

  if (
    typeof body.endpointId !== "number" ||
    !Number.isInteger(body.endpointId) ||
    body.endpointId <= 0
  ) {
    errors.push({
      field: "endpointId",
      message: "endpointId is required and must be a positive integer",
    });
  }

  if (typeof body.anchor !== "string" || !isReminderAnchor(body.anchor)) {
    errors.push({
      field: "anchor",
      message: "anchor must be one of: due, start",
    });
  }

  if (
    typeof body.offsetMinutes !== "number" ||
    !Number.isInteger(body.offsetMinutes)
  ) {
    errors.push({
      field: "offsetMinutes",
      message: "offsetMinutes is required and must be an integer",
    });
  }

  if (
    body.allDayLocalTime !== undefined &&
    body.allDayLocalTime !== null &&
    (typeof body.allDayLocalTime !== "string" ||
      !isValidAllDayLocalTime(body.allDayLocalTime))
  ) {
    errors.push({
      field: "allDayLocalTime",
      message: "allDayLocalTime must be in HH:MM format",
    });
  }

  if (body.enabled !== undefined && !isValidFlag(body.enabled)) {
    errors.push({
      field: "enabled",
      message: "enabled must be 0 or 1",
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const data: Omit<CreateTaskReminderInput, "taskId"> = {
    endpointId: body.endpointId as number,
    anchor: body.anchor as Omit<CreateTaskReminderInput, "taskId">["anchor"],
    offsetMinutes: body.offsetMinutes as number,
  };

  if (body.allDayLocalTime !== undefined) {
    data.allDayLocalTime = body.allDayLocalTime as string | null;
  }
  if (body.enabled !== undefined) {
    data.enabled = body.enabled as 0 | 1;
  }

  return { success: true, data };
}

export function validateUpdateTaskReminder(
  body: unknown,
): ValidationResult<UpdateTaskReminderInput> {
  if (!isRecord(body)) {
    return {
      success: false,
      errors: [{ field: "body", message: "Request body must be an object" }],
    };
  }

  const errors: ValidationError[] = [];

  if (
    body.endpointId !== undefined &&
    (typeof body.endpointId !== "number" ||
      !Number.isInteger(body.endpointId) ||
      body.endpointId <= 0)
  ) {
    errors.push({
      field: "endpointId",
      message: "endpointId must be a positive integer",
    });
  }

  if (
    body.anchor !== undefined &&
    (typeof body.anchor !== "string" || !isReminderAnchor(body.anchor))
  ) {
    errors.push({
      field: "anchor",
      message: "anchor must be one of: due, start",
    });
  }

  if (
    body.offsetMinutes !== undefined &&
    (typeof body.offsetMinutes !== "number" ||
      !Number.isInteger(body.offsetMinutes))
  ) {
    errors.push({
      field: "offsetMinutes",
      message: "offsetMinutes must be an integer",
    });
  }

  if (
    body.allDayLocalTime !== undefined &&
    body.allDayLocalTime !== null &&
    (typeof body.allDayLocalTime !== "string" ||
      !isValidAllDayLocalTime(body.allDayLocalTime))
  ) {
    errors.push({
      field: "allDayLocalTime",
      message: "allDayLocalTime must be in HH:MM format or null",
    });
  }

  if (body.enabled !== undefined && !isValidFlag(body.enabled)) {
    errors.push({
      field: "enabled",
      message: "enabled must be 0 or 1",
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const data: UpdateTaskReminderInput = {};

  if (body.endpointId !== undefined)
    data.endpointId = body.endpointId as number;
  if (body.anchor !== undefined) {
    data.anchor = body.anchor as UpdateTaskReminderInput["anchor"];
  }
  if (body.offsetMinutes !== undefined) {
    data.offsetMinutes = body.offsetMinutes as number;
  }
  if (body.allDayLocalTime !== undefined) {
    data.allDayLocalTime = body.allDayLocalTime as string | null;
  }
  if (body.enabled !== undefined) data.enabled = body.enabled as 0 | 1;

  return { success: true, data };
}
