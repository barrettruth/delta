import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../src/db/schema";
import { categoryColors, tasks } from "../src/db/schema";

const dbPath = process.env.DATABASE_URL ?? "./data/delta.db";
const userId = Number(process.argv[2] || 2);

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

function iso(date: Date, hours: number, minutes = 0): string {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function dayOffset(days: number): Date {
  return new Date(today.getTime() + days * 86400000);
}

const ts = now.toISOString();
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

const seedTasks = [
  {
    description: "Weekly team standup",
    status: "pending" as const,
    category: "Work",
    due: iso(today, 9, 30),
    startAt: iso(today, 9, 30),
    endAt: iso(today, 10, 0),
    allDay: 0,
    timezone: tz,
    recurrence: "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
    recurMode: "scheduled" as const,
    location: "Conference Room B",
    locationLat: 40.7128,
    locationLon: -74.006,
    meetingUrl: "https://meet.google.com/abc-defg-hij",
    notes:
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Discuss sprint progress and blockers."}]}]}',
    order: 1,
  },
  {
    description: "Deploy v0.1.0 release candidate",
    status: "wip" as const,
    category: "Work",
    due: iso(today, 14, 0),
    startAt: iso(today, 13, 0),
    endAt: iso(today, 15, 30),
    allDay: 0,
    timezone: tz,
    location: "Home office",
    notes:
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Run full CI suite, tag release, push to staging."}]}]}',
    order: 2,
  },
  {
    description: "Review pull request #142",
    status: "blocked" as const,
    category: "Work",
    due: iso(dayOffset(1), 11, 0),
    startAt: iso(dayOffset(1), 11, 0),
    endAt: iso(dayOffset(1), 11, 45),
    allDay: 0,
    timezone: tz,
    meetingUrl: "https://github.com/barrettruth/delta/pull/142",
    notes:
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Blocked on CI green. PWA manifest needs testing."}]}]}',
    order: 3,
  },
  {
    description: "Dentist appointment",
    status: "pending" as const,
    category: "Personal",
    due: iso(dayOffset(2), 8, 0),
    startAt: iso(dayOffset(2), 8, 0),
    endAt: iso(dayOffset(2), 9, 0),
    allDay: 0,
    timezone: tz,
    location: "Dr. Chen, 450 Lexington Ave",
    locationLat: 40.7537,
    locationLon: -73.9747,
    order: 4,
  },
  {
    description: "Grocery run",
    status: "pending" as const,
    category: "Personal",
    due: iso(dayOffset(1), 17, 0),
    startAt: iso(dayOffset(1), 17, 0),
    endAt: iso(dayOffset(1), 18, 0),
    allDay: 0,
    timezone: tz,
    location: "Trader Joe's, Union Square",
    locationLat: 40.7359,
    locationLon: -73.9911,
    notes:
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Eggs, bread, coffee, olive oil, parmesan."}]}]}',
    order: 5,
  },
  {
    description: "Company all-hands",
    status: "pending" as const,
    category: "Work",
    due: iso(today, 0),
    startAt: iso(today, 0),
    endAt: iso(today, 23, 59),
    allDay: 1,
    timezone: tz,
    meetingUrl: "https://zoom.us/j/123456789",
    notes:
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Q1 review and Q2 planning."}]}]}',
    order: 6,
  },
  {
    description: "Project deadline: API v2",
    status: "pending" as const,
    category: "Work",
    due: iso(dayOffset(3), 0),
    startAt: iso(dayOffset(3), 0),
    endAt: iso(dayOffset(3), 23, 59),
    allDay: 1,
    timezone: tz,
    order: 7,
  },
  {
    description: "Mom's birthday",
    status: "pending" as const,
    category: "Personal",
    due: iso(dayOffset(4), 0),
    startAt: iso(dayOffset(4), 0),
    endAt: iso(dayOffset(4), 23, 59),
    allDay: 1,
    timezone: tz,
    notes:
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Call at 6pm. Gift shipped already."}]}]}',
    order: 8,
  },
  {
    description: "Conference travel day",
    status: "pending" as const,
    category: "Work",
    due: iso(dayOffset(5), 0),
    startAt: iso(dayOffset(5), 0),
    endAt: iso(dayOffset(6), 23, 59),
    allDay: 1,
    timezone: tz,
    location: "Austin Convention Center",
    locationLat: 30.2634,
    locationLon: -97.7398,
    order: 9,
  },
  {
    description: "Read DDIA chapter 9",
    status: "pending" as const,
    category: "Learning",
    due: iso(dayOffset(2), 20, 0),
    startAt: iso(dayOffset(2), 20, 0),
    endAt: iso(dayOffset(2), 21, 30),
    allDay: 0,
    timezone: tz,
    location: "Home",
    notes:
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Consistency and consensus chapter. Take notes on Raft."}]}]}',
    order: 10,
  },
  {
    description: "Lunch with Alex",
    status: "pending" as const,
    category: "Personal",
    due: iso(dayOffset(1), 12, 0),
    startAt: iso(dayOffset(1), 12, 0),
    endAt: iso(dayOffset(1), 13, 0),
    allDay: 0,
    timezone: tz,
    location: "Sweetgreen, Broadway",
    locationLat: 40.7484,
    locationLon: -73.9857,
    order: 11,
  },
  {
    description: "Fix hydration mismatch in calendar",
    status: "done" as const,
    category: "Work",
    due: iso(dayOffset(-1), 16, 0),
    startAt: iso(dayOffset(-1), 14, 0),
    endAt: iso(dayOffset(-1), 16, 0),
    allDay: 0,
    timezone: tz,
    completedAt: iso(dayOffset(-1), 15, 45),
    order: 12,
  },
  {
    description: "Cancel old AWS instances",
    status: "cancelled" as const,
    category: "Work",
    due: iso(dayOffset(-2), 10, 0),
    order: 13,
  },
  {
    description: "Morning run",
    status: "pending" as const,
    category: "Health",
    due: iso(dayOffset(1), 6, 30),
    startAt: iso(dayOffset(1), 6, 30),
    endAt: iso(dayOffset(1), 7, 15),
    allDay: 0,
    timezone: tz,
    recurrence: "RRULE:FREQ=DAILY",
    recurMode: "scheduled" as const,
    location: "Central Park loop",
    locationLat: 40.7829,
    locationLon: -73.9654,
    order: 14,
  },
  {
    description: "Write blog post on Nix flakes",
    status: "wip" as const,
    category: "Learning",
    due: iso(dayOffset(3), 15, 0),
    startAt: iso(dayOffset(3), 14, 0),
    endAt: iso(dayOffset(3), 16, 0),
    allDay: 0,
    timezone: tz,
    notes:
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Outline done. Need to write the flake.nix walkthrough section."}]}]}',
    order: 15,
  },
  {
    description: "Biweekly 1:1 with manager",
    status: "pending" as const,
    category: "Work",
    due: iso(dayOffset(2), 10, 0),
    startAt: iso(dayOffset(2), 10, 0),
    endAt: iso(dayOffset(2), 10, 30),
    allDay: 0,
    timezone: tz,
    recurrence: "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE",
    recurMode: "scheduled" as const,
    meetingUrl: "https://meet.google.com/xyz-abcd-efg",
    order: 16,
  },
  {
    description: "Hackathon",
    status: "pending" as const,
    category: "Work",
    due: iso(dayOffset(5), 0),
    startAt: iso(dayOffset(5), 0),
    endAt: iso(dayOffset(5), 23, 59),
    allDay: 1,
    timezone: tz,
    location: "Office, 5th floor",
    notes:
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Theme: developer tooling. Team with Sarah and James."}]}]}',
    order: 17,
  },
  {
    description: "Pay rent",
    status: "pending" as const,
    category: "Personal",
    due: iso(dayOffset(1), 0),
    startAt: iso(dayOffset(1), 0),
    endAt: iso(dayOffset(1), 23, 59),
    allDay: 1,
    timezone: tz,
    recurrence: "RRULE:FREQ=MONTHLY;BYMONTHDAY=1",
    recurMode: "scheduled" as const,
    order: 18,
  },
  {
    description: "Evening yoga",
    status: "pending" as const,
    category: "Health",
    due: iso(today, 18, 0),
    startAt: iso(today, 18, 0),
    endAt: iso(today, 19, 0),
    allDay: 0,
    timezone: tz,
    location: "YogaWorks, 14th St",
    locationLat: 40.7366,
    locationLon: -73.9968,
    order: 19,
  },
  {
    description: "Ship onboarding flow",
    status: "pending" as const,
    category: "Work",
    due: iso(dayOffset(4), 17, 0),
    startAt: iso(dayOffset(4), 14, 0),
    endAt: iso(dayOffset(4), 17, 0),
    allDay: 0,
    timezone: tz,
    notes:
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"3-step wizard: view pref, integrations, keymaps. No summary step."}]}]}',
    order: 20,
  },
];

const colors = [
  { category: "Work", color: "#7aa2f7" },
  { category: "Personal", color: "#c678dd" },
  { category: "Learning", color: "#e5c07b" },
  { category: "Health", color: "#98c379" },
];

let inserted = 0;
for (const t of seedTasks) {
  db.insert(tasks)
    .values({
      userId,
      description: t.description,
      status: t.status,
      category: t.category,
      due: t.due ?? null,
      startAt: t.startAt ?? null,
      endAt: t.endAt ?? null,
      allDay: t.allDay ?? 0,
      timezone: t.timezone ?? null,
      recurrence: t.recurrence ?? null,
      recurMode: t.recurMode ?? null,
      notes: t.notes ?? null,
      order: t.order,
      location: t.location ?? null,
      locationLat: t.locationLat ?? null,
      locationLon: t.locationLon ?? null,
      meetingUrl: t.meetingUrl ?? null,
      completedAt: t.completedAt ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  inserted++;
}

for (const c of colors) {
  db.insert(categoryColors)
    .values({ userId, category: c.category, color: c.color })
    .onConflictDoUpdate({
      target: [categoryColors.userId, categoryColors.category],
      set: { color: c.color },
    })
    .run();
}

console.log(
  `Inserted ${inserted} tasks and ${colors.length} category colors for user ${userId}`,
);
sqlite.close();
