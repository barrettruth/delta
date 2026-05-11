import { and, count, eq } from "drizzle-orm";
import { categoryColors, tasks } from "@/db/schema";
import type { Db } from "./types";

export interface CategorySummary {
  name: string;
  count: number;
  color: string | null;
}

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

export function listCategories(db: Db, userId: number): CategorySummary[] {
  return db
    .select({
      name: tasks.category,
      count: count(tasks.id),
      color: categoryColors.color,
    })
    .from(tasks)
    .leftJoin(
      categoryColors,
      and(
        eq(categoryColors.userId, tasks.userId),
        eq(categoryColors.category, tasks.category),
      ),
    )
    .where(eq(tasks.userId, userId))
    .groupBy(tasks.category, categoryColors.color)
    .all()
    .filter((row): row is CategorySummary => row.name !== null);
}

export function setCategoryColor(
  db: Db,
  userId: number,
  category: string,
  color: string,
): void {
  db.insert(categoryColors)
    .values({ userId, category, color })
    .onConflictDoUpdate({
      target: [categoryColors.userId, categoryColors.category],
      set: { color },
    })
    .run();
}

export function removeCategoryColor(
  db: Db,
  userId: number,
  category: string,
): void {
  db.delete(categoryColors)
    .where(
      and(
        eq(categoryColors.userId, userId),
        eq(categoryColors.category, category),
      ),
    )
    .run();
}
