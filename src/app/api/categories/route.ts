import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const rows = db
    .select({
      name: tasks.category,
      count: count(),
    })
    .from(tasks)
    .where(eq(tasks.userId, user.id))
    .groupBy(tasks.category)
    .all()
    .filter((r) => r.name !== null);

  return NextResponse.json(rows);
}
