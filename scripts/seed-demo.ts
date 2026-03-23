import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { addDependency } from "../src/core/dag";
import { createTask, updateTask } from "../src/core/task";
import * as schema from "../src/db/schema";

const dbPath = process.env.DATABASE_URL ?? "./data/delta.db";
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: "./drizzle" });

const now = new Date();
function daysFromNow(n: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

const taxes = createTask(db, {
  description: "File 2025 federal tax return",
  category: "Life Admin",
  priority: 3,
  due: daysFromNow(14),
  status: "wip",
});

const stateReturn = createTask(db, {
  description: "File TX + NY state tax returns",
  category: "Life Admin",
  priority: 2,
  due: daysFromNow(14),
});
addDependency(db, stateReturn.id, taxes.id);

createTask(db, {
  description: "Submit Roth IRA contribution for 2025",
  category: "Life Admin",
  priority: 2,
  due: daysFromNow(21),
});

createTask(db, {
  description: "Review health insurance options for IMC",
  category: "Life Admin",
  priority: 1,
  due: daysFromNow(60),
});

const canolaRefactor = createTask(db, {
  description: "Refactor canola.nvim highlight module",
  category: "Open Source",
  priority: 2,
  status: "wip",
});

createTask(db, {
  description: "Fix diagnostic range off-by-one in canola.nvim",
  category: "Open Source",
  priority: 3,
  due: daysFromNow(3),
});

const canolaDocs = createTask(db, {
  description: "Write canola.nvim migration guide from oil.nvim",
  category: "Open Source",
  priority: 1,
  due: daysFromNow(10),
});
addDependency(db, canolaDocs.id, canolaRefactor.id);

createTask(db, {
  description: "Triage pending.nvim issues",
  category: "Open Source",
  priority: 1,
  due: daysFromNow(7),
  recurrence: "FREQ=WEEKLY;BYDAY=SU",
  recurMode: "scheduled",
});

createTask(db, {
  description: "Review open PRs on GitHub repos",
  category: "Open Source",
  priority: 2,
  due: daysFromNow(1),
  recurrence: "FREQ=DAILY",
  recurMode: "completion",
});

const _cs3120hw = createTask(db, {
  description: "CS 3120: Homework 6 — NP-completeness proofs",
  category: "School",
  priority: 3,
  due: daysFromNow(5),
  status: "wip",
});

createTask(db, {
  description: "CS 3120: Study for midterm 2",
  category: "School",
  priority: 2,
  due: daysFromNow(12),
});

createTask(db, {
  description: "MATH 3354: Problem set 8 — ring homomorphisms",
  category: "School",
  priority: 2,
  due: daysFromNow(4),
});

createTask(db, {
  description: "PSYC 2410: Read Chapter 12 — Social Cognition",
  category: "School",
  priority: 1,
  due: daysFromNow(6),
});

createTask(db, {
  description: "Prepare IMC onboarding documents",
  category: "Career",
  priority: 1,
  due: daysFromNow(90),
});

createTask(db, {
  description: "Set up Chicago apartment search alerts",
  category: "Career",
  priority: 2,
  due: daysFromNow(30),
});

createTask(db, {
  description: "Send thank-you note to Ramp manager",
  category: "Career",
  priority: 1,
  due: daysFromNow(2),
});

const lektraBuild = createTask(db, {
  description: "Fix lektra build on NixOS 24.11",
  category: "Open Source",
  priority: 2,
  status: "wip",
});

const lektraRelease = createTask(db, {
  description: "Tag lektra v2.0 release",
  category: "Open Source",
  priority: 1,
  due: daysFromNow(14),
});
addDependency(db, lektraRelease.id, lektraBuild.id);

createTask(db, {
  description: "Weekly grocery run",
  category: "Todo",
  priority: 0,
  due: daysFromNow(2),
  recurrence: "FREQ=WEEKLY;BYDAY=SA",
  recurMode: "scheduled",
});

createTask(db, {
  description: "Clean apartment",
  category: "Todo",
  priority: 0,
  due: daysFromNow(3),
  recurrence: "FREQ=WEEKLY;BYDAY=SU",
  recurMode: "completion",
});

createTask(db, {
  description: "Back up NixOS config to Forgejo",
  category: "Todo",
  priority: 1,
  due: daysFromNow(1),
  recurrence: "FREQ=MONTHLY;BYMONTHDAY=1",
  recurMode: "scheduled",
});

const completedOld = createTask(db, {
  description: "Set up delta deploy pipeline",
  category: "Open Source",
  priority: 2,
});
updateTask(db, completedOld.id, { status: "done" });

const completedOld2 = createTask(db, {
  description: "Write delta Drizzle schema",
  category: "Open Source",
  priority: 2,
});
updateTask(db, completedOld2.id, { status: "done" });

const completedOld3 = createTask(db, {
  description: "Submit DRW expense report",
  category: "Career",
  priority: 1,
});
updateTask(db, completedOld3.id, { status: "done" });

createTask(db, {
  description: "Update barrettruth.com portfolio with delta",
  category: "Career",
  priority: 1,
  due: daysFromNow(20),
  notes: JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Add delta to the projects section. Include:" },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "Screenshot of the midnight theme" },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Tech stack: Next.js, Drizzle, SQLite, Tiptap",
                  },
                ],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Link to GitHub repo" }],
              },
            ],
          },
        ],
      },
    ],
  }),
});

createTask(db, {
  description: "Investigate vikunja as delta alternative",
  category: "Todo",
  priority: 0,
  status: "cancelled",
});

console.log("Seeded demo data:");
const all = db.select().from(schema.tasks).all();
const byStatus: Record<string, number> = {};
for (const t of all) {
  byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
}
console.log(`  ${all.length} tasks total`);
for (const [status, count] of Object.entries(byStatus)) {
  console.log(`  ${status}: ${count}`);
}
const deps = db.select().from(schema.taskDependencies).all();
console.log(`  ${deps.length} dependencies`);

sqlite.close();
