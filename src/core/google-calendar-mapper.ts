import type { GoogleEvent } from "./google-calendar";
import type { CreateTaskInput, Task, TaskStatus } from "./types";

interface ProseMirrorNode {
  type: string;
  text?: string;
  content?: ProseMirrorNode[];
}

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "codeBlock",
  "blockquote",
]);

function extractTextFromNode(node: ProseMirrorNode): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  if (node.type === "hardBreak") return "\n";

  if (!node.content) {
    if (BLOCK_TYPES.has(node.type)) return "\n";
    return "";
  }

  const parts: string[] = [];
  for (const child of node.content) {
    parts.push(extractTextFromNode(child));
  }

  const inner = parts.join("");

  if (BLOCK_TYPES.has(node.type)) {
    return `${inner}\n`;
  }

  return inner;
}

export function extractPlainText(notes: string | null | undefined): string {
  if (!notes) return "";

  let parsed: ProseMirrorNode;
  try {
    parsed = JSON.parse(notes);
  } catch {
    return notes;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("type" in parsed) ||
    parsed.type !== "doc"
  ) {
    return notes;
  }

  if (!parsed.content) return "";

  return extractTextFromNode(parsed).replace(/\n+$/, "");
}

function googleStatusToTaskStatus(
  googleStatus: string | undefined,
): TaskStatus {
  if (googleStatus === "cancelled") return "cancelled";
  return "pending";
}

function taskStatusToGoogleStatus(status: TaskStatus): string {
  if (status === "cancelled") return "cancelled";
  return "confirmed";
}

export function googleEventToTaskInput(
  event: GoogleEvent,
): Partial<CreateTaskInput> {
  const input: Partial<CreateTaskInput> = {};

  input.description = event.summary ?? "(No title)";
  input.externalId = `gcal:${event.id}`;
  input.externalSource = "google_calendar";

  if (event.description) {
    input.notes = event.description;
  }

  if (event.start) {
    if (event.start.dateTime) {
      input.startAt = event.start.dateTime;
      input.allDay = 0;
    } else if (event.start.date) {
      input.startAt = event.start.date;
      input.allDay = 1;
    }

    if (event.start.timeZone) {
      input.timezone = event.start.timeZone;
    }
  }

  if (event.end) {
    if (event.end.dateTime) {
      input.endAt = event.end.dateTime;
    } else if (event.end.date) {
      input.endAt = event.end.date;
    }
  }

  if (event.location) {
    input.location = event.location;
  }

  if (event.conferenceData?.entryPoints?.length) {
    const videoEntry = event.conferenceData.entryPoints.find(
      (ep) => ep.entryPointType === "video" && ep.uri,
    );
    const firstWithUri = event.conferenceData.entryPoints.find((ep) => ep.uri);
    const entry = videoEntry ?? firstWithUri;
    if (entry?.uri) {
      input.meetingUrl = entry.uri;
    }
  }

  if (event.recurrence?.length) {
    for (const line of event.recurrence) {
      if (line.startsWith("RRULE:")) {
        input.recurrence = line.slice(6);
        break;
      }
      if (
        !line.startsWith("EXDATE") &&
        !line.startsWith("RDATE") &&
        !line.startsWith("DTSTART")
      ) {
        input.recurrence = line;
        break;
      }
    }
  }

  if (event.status) {
    input.status = googleStatusToTaskStatus(event.status);
  }

  return input;
}

export function taskToGoogleEvent(task: Task): Record<string, unknown> {
  const event: Record<string, unknown> = {};

  event.summary = task.description;

  if (task.notes) {
    event.description = extractPlainText(task.notes);
  }

  if (task.startAt) {
    if (task.allDay === 1) {
      event.start = { date: task.startAt.slice(0, 10) };
    } else {
      const startObj: Record<string, string> = {
        dateTime: task.startAt,
      };
      if (task.timezone) {
        startObj.timeZone = task.timezone;
      }
      event.start = startObj;
    }
  }

  if (task.endAt) {
    if (task.allDay === 1) {
      event.end = { date: task.endAt.slice(0, 10) };
    } else {
      const endObj: Record<string, string> = {
        dateTime: task.endAt,
      };
      if (task.timezone) {
        endObj.timeZone = task.timezone;
      }
      event.end = endObj;
    }
  }

  if (task.location) {
    event.location = task.location;
  }

  if (task.recurrence) {
    const rrule = task.recurrence.startsWith("RRULE:")
      ? task.recurrence
      : `RRULE:${task.recurrence}`;
    event.recurrence = [rrule];
  }

  event.status = taskStatusToGoogleStatus(task.status as TaskStatus);

  return event;
}
