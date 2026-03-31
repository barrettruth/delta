const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const RELATIVE_RE = /^\+(\d+)([dwm])$/;

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function nextWeekday(name: string): Date {
  const today = new Date();
  const todayDay = today.getDay();
  const targetDay = DAY_NAMES.indexOf(
    name.toLowerCase() as (typeof DAY_NAMES)[number],
  );
  if (targetDay === -1) throw new Error(`Unknown day: ${name}`);

  let diff = targetDay - todayDay;
  if (diff <= 0) diff += 7;

  return startOfDay(addDays(today, diff));
}

function endOfWeek(): Date {
  const today = new Date();
  const todayDay = today.getDay();
  const daysUntilSunday = todayDay === 0 ? 0 : 7 - todayDay;
  return startOfDay(addDays(today, daysUntilSunday));
}

function endOfMonth(): Date {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return startOfDay(d);
}

export function parseDate(input: string): string {
  if (ISO_DATETIME_RE.test(input)) {
    return new Date(input).toISOString();
  }

  if (ISO_DATE_RE.test(input)) {
    return new Date(`${input}T00:00:00`).toISOString();
  }

  const relativeMatch = input.match(RELATIVE_RE);
  if (relativeMatch) {
    const [, amount, unit] = relativeMatch;
    const n = Number.parseInt(amount, 10);
    const now = new Date();

    switch (unit) {
      case "d":
        return addDays(now, n).toISOString();
      case "w":
        return addDays(now, n * 7).toISOString();
      case "m": {
        const d = new Date(now);
        d.setMonth(d.getMonth() + n);
        return d.toISOString();
      }
    }
  }

  const lower = input.toLowerCase().trim();

  switch (lower) {
    case "today":
      return startOfDay(new Date()).toISOString();
    case "tomorrow":
      return startOfDay(addDays(new Date(), 1)).toISOString();
    case "yesterday":
      return startOfDay(addDays(new Date(), -1)).toISOString();
    case "eow":
      return endOfWeek().toISOString();
    case "eom":
      return endOfMonth().toISOString();
    case "next week":
      return startOfDay(addDays(new Date(), 7)).toISOString();
    case "next month": {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return startOfDay(d).toISOString();
    }
  }

  if (DAY_NAMES.includes(lower as (typeof DAY_NAMES)[number])) {
    return nextWeekday(lower).toISOString();
  }

  throw new Error(`Cannot parse date: "${input}"`);
}
