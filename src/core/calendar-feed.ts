import { randomBytes } from "node:crypto";
import { and, eq, isNotNull, max } from "drizzle-orm";
import { tasks, users } from "@/db/schema";
import { tasksToICalendar } from "./ical/serializer";
import type { Db } from "./types";

export function generateFeedToken(db: Db, userId: number): string {
  const token = randomBytes(32).toString("hex");
  db.update(users)
    .set({ calendarFeedToken: token })
    .where(eq(users.id, userId))
    .run();
  return token;
}

export function revokeFeedToken(db: Db, userId: number): void {
  db.update(users)
    .set({ calendarFeedToken: null })
    .where(eq(users.id, userId))
    .run();
}

export function getFeedToken(db: Db, userId: number): string | null {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  return user?.calendarFeedToken ?? null;
}

export function getUserByFeedToken(
  db: Db,
  token: string,
): { id: number; username: string } | null {
  const user = db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.calendarFeedToken, token))
    .get();
  return user ?? null;
}

export function getLastModified(db: Db, userId: number): Date | null {
  const row = db
    .select({ latest: max(tasks.updatedAt) })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNotNull(tasks.startAt)))
    .get();
  return row?.latest ? new Date(row.latest) : null;
}

export function generateFeedIcs(db: Db, userId: number): string {
  const userTasks = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNotNull(tasks.startAt)))
    .all();

  return tasksToICalendar(userTasks, "delta");
}
