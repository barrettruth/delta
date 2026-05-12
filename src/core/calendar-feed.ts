import { randomBytes } from "node:crypto";
import { and, eq, isNotNull, max } from "drizzle-orm";
import { calendarFeedTokens, tasks, users } from "@/db/schema";
import { tasksToICalendar } from "./ical/serializer";
import type { Db } from "./types";

export function generateFeedToken(db: Db, userId: number): string {
  const token = randomBytes(32).toString("hex");
  const now = new Date().toISOString();
  db.insert(calendarFeedTokens)
    .values({
      userId,
      token,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: calendarFeedTokens.userId,
      set: {
        token,
        updatedAt: now,
      },
    })
    .run();
  return token;
}

export function revokeFeedToken(db: Db, userId: number): void {
  db.delete(calendarFeedTokens)
    .where(eq(calendarFeedTokens.userId, userId))
    .run();
}

export function getFeedToken(db: Db, userId: number): string | null {
  const feed = db
    .select({ token: calendarFeedTokens.token })
    .from(calendarFeedTokens)
    .where(eq(calendarFeedTokens.userId, userId))
    .get();
  return feed?.token ?? null;
}

export function getUserByFeedToken(
  db: Db,
  token: string,
): { id: number; username: string } | null {
  const user = db
    .select({ id: users.id, username: users.username })
    .from(calendarFeedTokens)
    .innerJoin(users, eq(users.id, calendarFeedTokens.userId))
    .where(eq(calendarFeedTokens.token, token))
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
