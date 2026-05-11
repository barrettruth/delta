import { beforeEach, describe, expect, it } from "vitest";
import {
  listCategories,
  listCategoryColors,
  removeCategoryColor,
  setCategoryColor,
} from "@/core/categories";
import { createTask, updateTask } from "@/core/task";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;
let userId: number;
let otherUserId: number;

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db).id;
  otherUserId = createTestUser(db).id;
});

describe("category data", () => {
  it("sets, updates, and removes category colors per user", () => {
    setCategoryColor(db, userId, "Work", "#111111");
    setCategoryColor(db, otherUserId, "Work", "#999999");
    setCategoryColor(db, userId, "Work", "#222222");

    expect(listCategoryColors(db, userId)).toEqual({ Work: "#222222" });
    expect(listCategoryColors(db, otherUserId)).toEqual({ Work: "#999999" });

    removeCategoryColor(db, userId, "Work");

    expect(listCategoryColors(db, userId)).toEqual({});
    expect(listCategoryColors(db, otherUserId)).toEqual({ Work: "#999999" });
  });

  it("lists owned task categories with counts and colors", () => {
    createTask(db, userId, { description: "A", category: "Work" });
    createTask(db, userId, { description: "B", category: "Work" });
    createTask(db, userId, { description: "C", category: "Personal" });
    const uncategorized = createTask(db, userId, { description: "D" });
    updateTask(db, uncategorized.id, { category: null });
    createTask(db, otherUserId, { description: "Other", category: "Work" });
    setCategoryColor(db, userId, "Work", "#123456");
    setCategoryColor(db, userId, "No Tasks", "#abcdef");
    setCategoryColor(db, otherUserId, "Personal", "#999999");

    const categories = listCategories(db, userId).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    expect(categories).toEqual([
      { name: "Personal", count: 1, color: null },
      { name: "Work", count: 2, color: "#123456" },
    ]);
  });
});
