import { eq } from "drizzle-orm";
import { categoryColors } from "@/db/schema";
import type { Db } from "./types";

export function listCategoryColors(
  db: Db,
  userId: number,
): Record<string, string> {
  return Object.fromEntries(
    db
      .select()
      .from(categoryColors)
      .where(eq(categoryColors.userId, userId))
      .all()
      .map((color) => [color.category, color.color]),
  );
}
