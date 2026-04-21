export interface ParsedEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: Date;
  dtend?: Date;
  allDay: boolean;
  timezone?: string;
  location?: string;
  url?: string;
  rrule?: string;
  status?: string;
  recurrenceId?: Date;
  exdates?: Date[];
  rdates?: Date[];
}

interface ParsedProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

interface ParsedDateValue {
  date: Date;
  allDay: boolean;
}

interface EventAccumulator {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  url?: string;
  googleConference?: string;
  rrule?: string;
  status?: string;
  customStatus?: string;
  dtstart?: ParsedDateValue;
  dtend?: ParsedDateValue;
  timezone?: string;
  recurrenceId?: Date;
  exdates: Date[];
  rdates: Date[];
}

function unfoldICalendar(icsContent: string): string[] {
  const rawLines = icsContent.split(/\r?\n/);
  const lines: string[] = [];

  for (const rawLine of rawLines) {
    if (
      (rawLine.startsWith(" ") || rawLine.startsWith("\t")) &&
      lines.length > 0
    ) {
      lines[lines.length - 1] += rawLine.slice(1);
    } else {
      lines.push(rawLine);
    }
  }

  return lines;
}

function splitOutsideQuotes(value: string, separator: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of value) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (char === separator && !inQuotes) {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  parts.push(current);
  return parts;
}

function parsePropertyLine(line: string): ParsedProperty | null {
  let separatorIdx = -1;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ":" && !inQuotes) {
      separatorIdx = i;
      break;
    }
  }

  if (separatorIdx === -1) return null;

  const header = line.slice(0, separatorIdx);
  const value = line.slice(separatorIdx + 1);
  const [rawName, ...rawParams] = splitOutsideQuotes(header, ";");
  if (!rawName) return null;

  const params: Record<string, string> = {};
  for (const rawParam of rawParams) {
    const eqIdx = rawParam.indexOf("=");
    if (eqIdx === -1) continue;
    const key = rawParam.slice(0, eqIdx).toUpperCase();
    let paramValue = rawParam.slice(eqIdx + 1);
    if (paramValue.startsWith('"') && paramValue.endsWith('"')) {
      paramValue = paramValue.slice(1, -1);
    }
    params[key] = paramValue;
  }

  return {
    name: rawName.toUpperCase(),
    params,
    value,
  };
}

function unescapeText(value: string): string {
  return value
    .replace(/\\[Nn]/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function normalizeDeltaStatus(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const status = value.toLowerCase();
  if (
    status === "pending" ||
    status === "done" ||
    status === "wip" ||
    status === "blocked" ||
    status === "cancelled"
  ) {
    return status;
  }
  return undefined;
}

function parseDateParts(value: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  isUtc: boolean;
} | null {
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/,
  );
  if (!match) return null;

  return {
    year: Number.parseInt(match[1], 10),
    month: Number.parseInt(match[2], 10),
    day: Number.parseInt(match[3], 10),
    hour: Number.parseInt(match[4] ?? "0", 10),
    minute: Number.parseInt(match[5] ?? "0", 10),
    second: Number.parseInt(match[6] ?? "0", 10),
    isUtc: match[7] === "Z",
  };
}

const timeZoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimeZoneFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = timeZoneFormatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  timeZoneFormatterCache.set(timeZone, formatter);
  return formatter;
}

function getTimeZoneParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = getTimeZoneFormatter(timeZone).formatToParts(date);
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};

  for (const part of parts) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      values[part.type] = Number.parseInt(part.value, 10);
    }
  }

  return {
    year: values.year ?? 0,
    month: values.month ?? 1,
    day: values.day ?? 1,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

function zonedDateTimeToUtc(
  parts: NonNullable<ReturnType<typeof parseDateParts>>,
  timeZone: string,
): Date {
  let guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  const target = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  try {
    for (let i = 0; i < 3; i++) {
      const actual = getTimeZoneParts(new Date(guess), timeZone);
      const actualAsUtc = Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
        actual.second,
      );
      const diff = target - actualAsUtc;
      if (diff === 0) break;
      guess += diff;
    }
  } catch {
    // Fall back to naive UTC parsing if TZID is not recognized by Intl.
  }

  return new Date(guess);
}

function parseICalDateTime(
  value: string,
  params: Record<string, string>,
): ParsedDateValue | null {
  const isAllDay =
    params.VALUE?.toUpperCase() === "DATE" || /^\d{8}$/.test(value);
  if (isAllDay) {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match) return null;

    return {
      date: new Date(
        Date.UTC(
          Number.parseInt(match[1], 10),
          Number.parseInt(match[2], 10) - 1,
          Number.parseInt(match[3], 10),
        ),
      ),
      allDay: true,
    };
  }

  const parts = parseDateParts(value);
  if (!parts) return null;

  if (parts.isUtc) {
    return {
      date: new Date(
        Date.UTC(
          parts.year,
          parts.month - 1,
          parts.day,
          parts.hour,
          parts.minute,
          parts.second,
        ),
      ),
      allDay: false,
    };
  }

  const tzid = params.TZID?.trim();
  if (tzid) {
    return {
      date: zonedDateTimeToUtc(parts, tzid),
      allDay: false,
    };
  }

  return {
    date: new Date(
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      ),
    ),
    allDay: false,
  };
}

function parseDateList(value: string, params: Record<string, string>): Date[] {
  const parsed: Date[] = [];
  for (const item of splitOutsideQuotes(value, ",")) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const parsedValue = parseICalDateTime(trimmed, params);
    if (parsedValue) {
      parsed.push(parsedValue.date);
    }
  }
  return parsed;
}

function eventToParsedEvent(event: EventAccumulator): ParsedEvent | null {
  if (!event.uid || !event.dtstart) return null;

  const parsed: ParsedEvent = {
    uid: event.uid,
    summary: event.summary ?? "",
    dtstart: event.dtstart.date,
    allDay: event.dtstart.allDay,
  };

  if (event.timezone) {
    parsed.timezone = event.timezone;
  }

  if (event.description) {
    parsed.description = event.description;
  }

  if (event.dtend) {
    parsed.dtend = event.dtend.date;
  }

  if (event.location) {
    parsed.location = event.location;
  }

  if (event.url) {
    parsed.url = event.url;
  } else if (event.googleConference) {
    parsed.url = event.googleConference;
  }

  if (event.rrule) {
    parsed.rrule = event.rrule;
  }

  const status = normalizeDeltaStatus(event.customStatus) ?? event.status;
  if (status) {
    parsed.status = status;
  }

  if (event.recurrenceId) {
    parsed.recurrenceId = event.recurrenceId;
  }

  if (event.exdates.length > 0) {
    parsed.exdates = event.exdates;
  }

  if (event.rdates.length > 0) {
    parsed.rdates = event.rdates;
  }

  return parsed;
}

function applyProperty(
  event: EventAccumulator,
  property: ParsedProperty,
): void {
  switch (property.name) {
    case "UID":
      event.uid ??= unescapeText(property.value);
      break;
    case "SUMMARY":
      event.summary ??= unescapeText(property.value);
      break;
    case "DESCRIPTION":
      event.description ??= unescapeText(property.value);
      break;
    case "LOCATION":
      event.location ??= unescapeText(property.value);
      break;
    case "URL":
      event.url ??= unescapeText(property.value);
      break;
    case "X-GOOGLE-CONFERENCE":
      event.googleConference ??= unescapeText(property.value);
      break;
    case "RRULE":
      event.rrule ??= property.value.replace(/^RRULE:/i, "");
      break;
    case "RECURRENCE-ID": {
      const recurrenceId = parseICalDateTime(property.value, property.params);
      if (recurrenceId) {
        event.recurrenceId = recurrenceId.date;
      }
      break;
    }
    case "EXDATE":
      event.exdates.push(...parseDateList(property.value, property.params));
      break;
    case "RDATE":
      event.rdates.push(...parseDateList(property.value, property.params));
      break;
    case "STATUS":
      event.status ??= unescapeText(property.value);
      break;
    case "X-DELTA-STATUS":
      event.customStatus ??= unescapeText(property.value);
      break;
    case "DTSTART":
      if (!event.dtstart) {
        event.dtstart =
          parseICalDateTime(property.value, property.params) ?? undefined;
        if (event.dtstart && !event.dtstart.allDay && property.params.TZID) {
          event.timezone = property.params.TZID.trim();
        }
      }
      break;
    case "DTEND":
      if (!event.dtend) {
        event.dtend =
          parseICalDateTime(property.value, property.params) ?? undefined;
      }
      break;
  }
}

export async function parseICalendar(
  icsContent: string,
): Promise<ParsedEvent[]> {
  const lines = unfoldICalendar(icsContent);
  const events: ParsedEvent[] = [];
  let currentEvent: EventAccumulator | null = null;
  let nestedDepth = 0;

  for (const line of lines) {
    if (!line) continue;
    const property = parsePropertyLine(line);
    if (!property) continue;

    if (property.name === "BEGIN") {
      if (property.value.toUpperCase() === "VEVENT" && !currentEvent) {
        currentEvent = { exdates: [], rdates: [] };
        nestedDepth = 0;
      } else if (currentEvent) {
        nestedDepth++;
      }
      continue;
    }

    if (property.name === "END") {
      if (property.value.toUpperCase() === "VEVENT" && currentEvent) {
        if (nestedDepth === 0) {
          const parsedEvent = eventToParsedEvent(currentEvent);
          if (parsedEvent) events.push(parsedEvent);
          currentEvent = null;
        } else {
          nestedDepth--;
        }
      } else if (currentEvent && nestedDepth > 0) {
        nestedDepth--;
      }
      continue;
    }

    if (!currentEvent || nestedDepth > 0) continue;
    applyProperty(currentEvent, property);
  }

  return events;
}
