import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { eventShareLinks, tasks } from "@/db/schema";
import type { Db, Task } from "./types";

const SHARE_LINK_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function generateShareLink(
  db: Db,
  userId: number,
  taskId: number,
  instanceDate?: string,
): string {
  const task = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .get();
  if (!task) throw new Error("task not found");
  if (!task.startAt) throw new Error("only calendar events can be shared");

  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SHARE_LINK_DURATION_MS).toISOString();

  db.insert(eventShareLinks)
    .values({
      token,
      taskId,
      createdBy: userId,
      instanceDate: instanceDate ?? null,
      expiresAt,
      createdAt: now,
    })
    .run();

  return token;
}

export function validateShareLink(
  db: Db,
  token: string,
): typeof eventShareLinks.$inferSelect | null {
  const link = db
    .select()
    .from(eventShareLinks)
    .where(
      and(
        eq(eventShareLinks.token, token),
        gt(eventShareLinks.expiresAt, new Date().toISOString()),
      ),
    )
    .get();
  return link ?? null;
}

export function acceptShareLink(
  db: Db,
  recipientUserId: number,
  token: string,
): Task {
  const link = validateShareLink(db, token);
  if (!link) throw new Error("invalid or expired share link");

  const source = db.select().from(tasks).where(eq(tasks.id, link.taskId)).get();
  if (!source) throw new Error("source event no longer exists");

  let startAt = source.startAt;
  let endAt = source.endAt;

  if (link.instanceDate && source.recurrence && source.startAt) {
    const origStart = new Date(source.startAt);
    const instanceStart = new Date(link.instanceDate);
    instanceStart.setHours(
      origStart.getHours(),
      origStart.getMinutes(),
      origStart.getSeconds(),
    );
    startAt = instanceStart.toISOString();
    if (source.endAt) {
      const duration = new Date(source.endAt).getTime() - origStart.getTime();
      endAt = new Date(instanceStart.getTime() + duration).toISOString();
    }
  }

  const now = new Date().toISOString();
  return db
    .insert(tasks)
    .values({
      userId: recipientUserId,
      description: source.description,
      status: "pending",
      category: source.category ?? "Todo",
      startAt,
      endAt,
      allDay: source.allDay ?? 0,
      timezone: source.timezone ?? null,
      due: null,
      recurrence: null,
      recurMode: null,
      notes: source.notes ?? null,
      order: 0,
      location: source.location ?? null,
      locationLat: source.locationLat ?? null,
      locationLon: source.locationLon ?? null,
      meetingUrl: source.meetingUrl ?? null,
      exdates: null,
      rdates: null,
      recurringTaskId: null,
      originalStartAt: null,
      sourceEventId: source.id,
      sourceUserId: link.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}
