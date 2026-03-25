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

export function sanitize(str: string): string {
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

  if (b.priority !== undefined) {
    if (
      typeof b.priority !== "number" ||
      !Number.isInteger(b.priority) ||
      b.priority < 0 ||
      b.priority > 3
    ) {
      errors.push({
        field: "priority",
        message: "priority must be an integer between 0 and 3",
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

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const data: CreateTaskInput = {
    description: sanitize((b.description as string).trim()),
  };

  if (b.status !== undefined) data.status = b.status as TaskStatus;
  if (b.priority !== undefined) data.priority = b.priority as number;
  if (b.due !== undefined && b.due !== null) data.due = b.due as string;
  if (b.notes !== undefined && b.notes !== null) {
    data.notes = sanitize(String(b.notes));
  }
  if (b.category !== undefined) data.category = b.category as string;
  if (b.label !== undefined && b.label !== null)
    data.label = sanitize(String(b.label).trim());
  if (b.recurrence !== undefined) data.recurrence = b.recurrence as string;
  if (b.recurMode !== undefined)
    data.recurMode = b.recurMode as CreateTaskInput["recurMode"];
  if (b.order !== undefined) data.order = b.order as number;

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

  if (b.priority !== undefined) {
    if (
      typeof b.priority !== "number" ||
      !Number.isInteger(b.priority) ||
      b.priority < 0 ||
      b.priority > 3
    ) {
      errors.push({
        field: "priority",
        message: "priority must be an integer between 0 and 3",
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

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const data: UpdateTaskInput = {};

  if (b.description !== undefined) {
    data.description = sanitize((b.description as string).trim());
  }
  if (b.status !== undefined) data.status = b.status as TaskStatus;
  if (b.priority !== undefined) data.priority = b.priority as number;
  if (b.due !== undefined) data.due = b.due as string | null;
  if (b.notes !== undefined) {
    data.notes = b.notes === null ? null : sanitize(String(b.notes));
  }
  if (b.category !== undefined) data.category = b.category as string | null;
  if (b.label !== undefined)
    data.label = b.label === null ? null : sanitize(String(b.label).trim());
  if (b.recurrence !== undefined)
    data.recurrence = b.recurrence as string | null;
  if (b.recurMode !== undefined)
    data.recurMode = b.recurMode as UpdateTaskInput["recurMode"];
  if (b.order !== undefined) data.order = b.order as number;

  return { success: true, data };
}
