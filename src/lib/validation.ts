import type {
  CreateTaskInput,
  RecurMode,
  TaskStatus,
  UpdateTaskInput,
} from "@/core/types";
import { RECUR_MODES, TASK_STATUSES } from "@/core/types";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

type TaskInputMode = "create" | "update";
type NormalizedTaskInput = {
  description?: string;
  status?: TaskStatus;
  category?: string | null;
  due?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  allDay?: number | null;
  timezone?: string | null;
  recurrence?: string | null;
  recurMode?: RecurMode | null;
  notes?: string | null;
  order?: number;
  location?: string | null;
  locationLat?: number | null;
  locationLon?: number | null;
  meetingUrl?: string | null;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function hasField(body: Record<string, unknown>, field: string): boolean {
  return Object.hasOwn(body, field);
}

function isValidIsoInstant(value: string): boolean {
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.toISOString() === value;
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isValidDueDate(value: string): boolean {
  return isValidDateOnly(value) || isValidIsoInstant(value);
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

function validateTextField(
  body: Record<string, unknown>,
  errors: ValidationError[],
  field: string,
  message: string,
  options: { required?: boolean; maxLength?: number } = {},
): void {
  const present = hasField(body, field);
  const value = body[field];

  if (!present) {
    if (options.required) errors.push({ field, message });
    return;
  }

  if (value === undefined && !options.required) return;
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push({ field, message });
    return;
  }

  if (
    options.maxLength !== undefined &&
    value.trim().length > options.maxLength
  ) {
    errors.push({
      field,
      message: `${field} must be a string of at most ${options.maxLength} characters`,
    });
  }
}

function validateLocation(
  body: Record<string, unknown>,
  errors: ValidationError[],
): void {
  if (!hasField(body, "location")) return;
  const value = body.location;
  if (value === undefined || value === null) return;
  if (typeof value !== "string" || value.trim().length > 500) {
    errors.push({
      field: "location",
      message: "location must be a string of at most 500 characters",
    });
  }
}

function validateStringField(
  body: Record<string, unknown>,
  errors: ValidationError[],
  field: string,
  message: string,
): void {
  if (!hasField(body, field)) return;
  const value = body[field];
  if (value !== null && value !== undefined && typeof value !== "string") {
    errors.push({ field, message });
  }
}

function validateNumberField(
  body: Record<string, unknown>,
  errors: ValidationError[],
  field: string,
  message: string,
): void {
  if (!hasField(body, field)) return;
  const value = body[field];
  if (
    value !== null &&
    value !== undefined &&
    (typeof value !== "number" || !Number.isFinite(value))
  ) {
    errors.push({ field, message });
  }
}

function validateDateField(
  body: Record<string, unknown>,
  errors: ValidationError[],
  field: "due" | "startAt" | "endAt",
): void {
  if (!hasField(body, field)) return;
  const value = body[field];
  if (value === null || value === undefined) return;

  const valid =
    typeof value === "string" &&
    (field === "due" ? isValidDueDate(value) : isValidIsoInstant(value));

  if (!valid) {
    errors.push({
      field,
      message:
        field === "due"
          ? "due must be a valid ISO 8601 date string or null"
          : `${field} must be a valid ISO 8601 date string`,
    });
  }
}

function validateEndAfterStart(
  body: Record<string, unknown>,
  errors: ValidationError[],
): void {
  if (
    typeof body.startAt === "string" &&
    isValidIsoInstant(body.startAt) &&
    typeof body.endAt === "string" &&
    isValidIsoInstant(body.endAt) &&
    new Date(body.endAt).getTime() <= new Date(body.startAt).getTime()
  ) {
    errors.push({ field: "endAt", message: "endAt must be after startAt" });
  }
}

function validateAllDay(
  body: Record<string, unknown>,
  errors: ValidationError[],
): void {
  if (!hasField(body, "allDay")) return;
  const value = body.allDay;
  if (value !== undefined && value !== null && value !== 0 && value !== 1) {
    errors.push({ field: "allDay", message: "allDay must be 0 or 1" });
  }
}

function validateTimezone(
  body: Record<string, unknown>,
  errors: ValidationError[],
): void {
  if (!hasField(body, "timezone")) return;
  const value = body.timezone;
  if (
    value !== undefined &&
    value !== null &&
    (typeof value !== "string" || !isValidTimezone(value))
  ) {
    errors.push({
      field: "timezone",
      message: "timezone must be a valid IANA timezone string",
    });
  }
}

function validateStatus(
  body: Record<string, unknown>,
  errors: ValidationError[],
): void {
  if (!hasField(body, "status")) return;
  if (body.status === undefined) return;
  if (!TASK_STATUSES.includes(body.status as TaskStatus)) {
    errors.push({
      field: "status",
      message: `status must be one of: ${TASK_STATUSES.join(", ")}`,
    });
  }
}

function validateRecurMode(
  body: Record<string, unknown>,
  errors: ValidationError[],
): void {
  if (!hasField(body, "recurMode")) return;
  const value = body.recurMode;
  if (
    value !== undefined &&
    value !== null &&
    !RECUR_MODES.includes(value as RecurMode)
  ) {
    errors.push({
      field: "recurMode",
      message: `recurMode must be one of: ${RECUR_MODES.join(", ")}`,
    });
  }
}

function validateMeetingUrl(
  body: Record<string, unknown>,
  errors: ValidationError[],
): void {
  if (!hasField(body, "meetingUrl")) return;
  const value = body.meetingUrl;
  if (value === undefined || value === null) return;

  if (typeof value !== "string") {
    errors.push({
      field: "meetingUrl",
      message: "meetingUrl must be a string",
    });
    return;
  }

  const trimmed = value.trim();
  if (trimmed.length > 2000) {
    errors.push({
      field: "meetingUrl",
      message: "meetingUrl must be at most 2000 characters",
    });
  } else if (!/^https?:\/\//i.test(trimmed)) {
    errors.push({
      field: "meetingUrl",
      message:
        "meetingUrl must be a valid URL starting with http:// or https://",
    });
  }
}

function validateTaskInputFields(
  body: Record<string, unknown>,
  mode: TaskInputMode,
): ValidationError[] {
  const errors: ValidationError[] = [];

  validateTextField(
    body,
    errors,
    "description",
    mode === "create"
      ? "description is required and must be a non-empty string"
      : "description must be a non-empty string",
    { required: mode === "create" },
  );
  validateStatus(body, errors);
  validateDateField(body, errors, "due");
  validateDateField(body, errors, "startAt");
  validateDateField(body, errors, "endAt");
  validateEndAfterStart(body, errors);
  validateAllDay(body, errors);
  validateTimezone(body, errors);
  validateLocation(body, errors);
  validateMeetingUrl(body, errors);
  validateStringField(
    body,
    errors,
    "recurrence",
    "recurrence must be a string or null",
  );
  validateRecurMode(body, errors);
  validateStringField(
    body,
    errors,
    "category",
    "category must be a string or null",
  );
  validateNumberField(body, errors, "order", "order must be a number");
  validateNumberField(
    body,
    errors,
    "locationLat",
    "locationLat must be a number or null",
  );
  validateNumberField(
    body,
    errors,
    "locationLon",
    "locationLon must be a number or null",
  );

  return errors;
}

function assignCreateField<K extends keyof CreateTaskInput>(
  data: CreateTaskInput,
  body: Record<string, unknown>,
  field: K,
  value: CreateTaskInput[K],
): void {
  if (hasField(body, field) && value !== undefined && value !== null) {
    data[field] = value;
  }
}

function assignUpdateField<K extends keyof UpdateTaskInput>(
  data: UpdateTaskInput,
  body: Record<string, unknown>,
  field: K,
  value: UpdateTaskInput[K],
): void {
  if (hasField(body, field) && value !== undefined) {
    data[field] = value;
  }
}

function normalizeTaskInput(
  body: Record<string, unknown>,
  mode: TaskInputMode,
): CreateTaskInput | UpdateTaskInput {
  const normalized: NormalizedTaskInput = {};

  if (hasField(body, "description") && typeof body.description === "string") {
    normalized.description = sanitize(body.description.trim());
  }
  if (hasField(body, "status")) {
    normalized.status = body.status as TaskStatus;
  }
  if (hasField(body, "due")) {
    normalized.due = body.due as string | null | undefined;
  }
  if (hasField(body, "notes")) {
    normalized.notes =
      body.notes === null || body.notes === undefined
        ? body.notes
        : sanitize(String(body.notes));
  }
  if (hasField(body, "category")) {
    normalized.category = body.category as string | null | undefined;
  }
  if (hasField(body, "recurrence")) {
    normalized.recurrence = body.recurrence as string | null | undefined;
  }
  if (hasField(body, "recurMode")) {
    normalized.recurMode = body.recurMode as RecurMode | null | undefined;
  }
  if (hasField(body, "order")) {
    normalized.order = body.order as number | undefined;
  }
  if (hasField(body, "startAt")) {
    normalized.startAt = body.startAt as string | null | undefined;
  }
  if (hasField(body, "endAt")) {
    normalized.endAt = body.endAt as string | null | undefined;
  }
  if (hasField(body, "allDay")) {
    normalized.allDay = body.allDay as number | null | undefined;
  }
  if (hasField(body, "timezone")) {
    normalized.timezone = body.timezone as string | null | undefined;
  }
  if (hasField(body, "location")) {
    normalized.location =
      body.location === null || body.location === undefined
        ? body.location
        : sanitize(String(body.location).trim());
  }
  if (hasField(body, "locationLat")) {
    normalized.locationLat = body.locationLat as number | null | undefined;
  }
  if (hasField(body, "locationLon")) {
    normalized.locationLon = body.locationLon as number | null | undefined;
  }
  if (hasField(body, "meetingUrl")) {
    normalized.meetingUrl =
      body.meetingUrl === null || body.meetingUrl === undefined
        ? body.meetingUrl
        : String(body.meetingUrl).trim();
  }

  if (mode === "create") {
    const data: CreateTaskInput = {
      description: normalized.description as string,
    };
    assignCreateField(data, body, "status", normalized.status as TaskStatus);
    assignCreateField(data, body, "due", normalized.due as string);
    assignCreateField(data, body, "notes", normalized.notes as string);
    assignCreateField(data, body, "category", normalized.category as string);
    assignCreateField(
      data,
      body,
      "recurrence",
      normalized.recurrence as string,
    );
    assignCreateField(
      data,
      body,
      "recurMode",
      normalized.recurMode as RecurMode,
    );
    assignCreateField(data, body, "order", normalized.order as number);
    assignCreateField(data, body, "startAt", normalized.startAt as string);
    assignCreateField(data, body, "endAt", normalized.endAt as string);
    assignCreateField(data, body, "allDay", normalized.allDay as number);
    assignCreateField(data, body, "timezone", normalized.timezone as string);
    assignCreateField(data, body, "location", normalized.location as string);
    assignCreateField(
      data,
      body,
      "locationLat",
      normalized.locationLat as number,
    );
    assignCreateField(
      data,
      body,
      "locationLon",
      normalized.locationLon as number,
    );
    assignCreateField(
      data,
      body,
      "meetingUrl",
      normalized.meetingUrl as string,
    );
    return data;
  }

  const data: UpdateTaskInput = {};
  assignUpdateField(data, body, "description", normalized.description);
  assignUpdateField(data, body, "status", normalized.status);
  assignUpdateField(data, body, "due", normalized.due as string | null);
  assignUpdateField(data, body, "notes", normalized.notes as string | null);
  assignUpdateField(
    data,
    body,
    "category",
    normalized.category as string | null,
  );
  assignUpdateField(
    data,
    body,
    "recurrence",
    normalized.recurrence as string | null,
  );
  assignUpdateField(
    data,
    body,
    "recurMode",
    normalized.recurMode as RecurMode | null,
  );
  assignUpdateField(data, body, "order", normalized.order);
  assignUpdateField(data, body, "startAt", normalized.startAt as string | null);
  assignUpdateField(data, body, "endAt", normalized.endAt as string | null);
  assignUpdateField(data, body, "allDay", normalized.allDay as number | null);
  assignUpdateField(
    data,
    body,
    "timezone",
    normalized.timezone as string | null,
  );
  assignUpdateField(
    data,
    body,
    "location",
    normalized.location as string | null,
  );
  assignUpdateField(
    data,
    body,
    "locationLat",
    normalized.locationLat as number | null,
  );
  assignUpdateField(
    data,
    body,
    "locationLon",
    normalized.locationLon as number | null,
  );
  assignUpdateField(
    data,
    body,
    "meetingUrl",
    normalized.meetingUrl as string | null,
  );
  return data;
}

function parseTaskInput<T extends CreateTaskInput | UpdateTaskInput>(
  body: unknown,
  mode: TaskInputMode,
): ValidationResult<T> {
  if (typeof body !== "object" || body === null) {
    return {
      success: false,
      errors: [{ field: "body", message: "Request body must be an object" }],
    };
  }

  const b = body as Record<string, unknown>;
  const errors = validateTaskInputFields(b, mode);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: normalizeTaskInput(b, mode) as T };
}

export function parseCreateTaskInput(
  body: unknown,
): ValidationResult<CreateTaskInput> {
  return parseTaskInput<CreateTaskInput>(body, "create");
}

export function parseUpdateTaskInput(
  body: unknown,
): ValidationResult<UpdateTaskInput> {
  return parseTaskInput<UpdateTaskInput>(body, "update");
}

export const validateCreateTask = parseCreateTaskInput;
export const validateUpdateTask = parseUpdateTaskInput;

export function formatValidationErrors(
  errors: ValidationError[] | undefined,
): string {
  if (!errors || errors.length === 0) return "Validation failed";
  return errors.map((error) => `${error.field}: ${error.message}`).join("; ");
}
