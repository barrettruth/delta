import { RRule, type Weekday } from "rrule";
import type { CreateTaskInput, RecurMode, Task } from "./types";

export function parseRRule(str: string): RRule {
  return RRule.fromString(str.replace(/^RRULE:/, ""));
}

export function rruleToText(rruleStr: string): string {
  const rule = parseRRule(rruleStr);
  return rule.toText();
}

export type RRuleFrequency =
  | "daily"
  | "weekly"
  | "weekdays"
  | "monthly"
  | "yearly";

export interface BuildRRuleOpts {
  freq: RRuleFrequency;
  interval?: number;
  byweekday?: number[];
  bymonthday?: number[];
  until?: Date;
  count?: number;
}

const WEEKDAY_MAP: Weekday[] = [
  RRule.MO,
  RRule.TU,
  RRule.WE,
  RRule.TH,
  RRule.FR,
  RRule.SA,
  RRule.SU,
];

export function buildRRule(opts: BuildRRuleOpts): string {
  if (opts.freq === "weekdays") {
    return new RRule({
      freq: RRule.WEEKLY,
      interval: opts.interval ?? 1,
      byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR],
      until: opts.until,
      count: opts.count,
    }).toString();
  }

  const freqMap: Record<Exclude<RRuleFrequency, "weekdays">, number> = {
    daily: RRule.DAILY,
    weekly: RRule.WEEKLY,
    monthly: RRule.MONTHLY,
    yearly: RRule.YEARLY,
  };

  const rruleOpts: ConstructorParameters<typeof RRule>[0] = {
    freq: freqMap[opts.freq],
    interval: opts.interval ?? 1,
    until: opts.until,
    count: opts.count,
  };

  if (opts.byweekday?.length) {
    rruleOpts.byweekday = opts.byweekday.map((i) => WEEKDAY_MAP[i]);
  }
  if (opts.bymonthday?.length) {
    rruleOpts.bymonthday = opts.bymonthday;
  }

  return new RRule(rruleOpts).toString();
}

export function getNextOccurrence(
  rruleStr: string,
  mode: RecurMode,
  currentAnchor: string | null,
  completedAt: string | null,
): Date | null {
  const base = parseRRule(rruleStr);

  if (mode === "scheduled") {
    const refSource = currentAnchor ?? completedAt;
    if (!refSource) return null;
    const ref = new Date(refSource);
    const rule = new RRule({
      ...base.origOptions,
      dtstart: new Date(refSource),
    });
    return rule.after(ref);
  }

  if (!completedAt) return null;

  const rule = new RRule({
    ...base.origOptions,
    dtstart: new Date(completedAt),
  });
  return rule.after(new Date(completedAt));
}

export function getNextTaskData(task: Task): CreateTaskInput | null {
  if (!task.recurrence || !task.completedAt) return null;

  const mode: RecurMode = task.recurMode ?? "scheduled";
  const anchor = task.startAt ?? task.due;
  if (!anchor) return null;

  const nextAnchor = getNextOccurrence(
    task.recurrence,
    mode,
    anchor,
    task.completedAt,
  );

  if (!nextAnchor) return null;

  const anchorDelta = nextAnchor.getTime() - new Date(anchor).getTime();

  let startAt: string | undefined;
  if (task.startAt) {
    startAt = new Date(
      new Date(task.startAt).getTime() + anchorDelta,
    ).toISOString();
  }

  let endAt: string | undefined;
  if (task.endAt) {
    endAt = new Date(
      new Date(task.endAt).getTime() + anchorDelta,
    ).toISOString();
  }

  let due: string | undefined;
  if (task.due) {
    due = new Date(new Date(task.due).getTime() + anchorDelta).toISOString();
  }

  return {
    description: task.description,
    category: task.category ?? undefined,
    due,
    startAt,
    endAt,
    allDay: task.allDay ?? undefined,
    timezone: task.timezone ?? undefined,
    recurrence: task.recurrence,
    recurMode: mode,
    notes: task.notes ?? undefined,
    order: task.order ?? undefined,
    location: task.location ?? undefined,
    locationLat: task.locationLat ?? undefined,
    locationLon: task.locationLon ?? undefined,
    meetingUrl: task.meetingUrl ?? undefined,
  };
}
