import { eq } from "drizzle-orm";
import { type ScheduledTask, schedule, validate } from "node-cron";
import { automations } from "@/db/schema";
import type { Db } from "./types";

export type RecipeHandler = (db: Db, config: unknown) => Promise<void>;

const recipes = new Map<string, RecipeHandler>();
const jobs = new Map<number, ScheduledTask>();

export function registerRecipe(type: string, handler: RecipeHandler): void {
  recipes.set(type, handler);
}

export function getRecipe(type: string): RecipeHandler | undefined {
  return recipes.get(type);
}

export async function runAutomation(
  db: Db,
  automationId: number,
): Promise<void> {
  await loadBuiltinRecipes();

  const automation = db
    .select()
    .from(automations)
    .where(eq(automations.id, automationId))
    .get();

  if (!automation) {
    throw new Error(`Automation ${automationId} not found`);
  }

  const handler = recipes.get(automation.type);
  if (!handler) {
    throw new Error(`Unknown recipe type: ${automation.type}`);
  }

  const config: unknown = JSON.parse(automation.config);
  await handler(db, config);

  db.update(automations)
    .set({ lastRunAt: new Date().toISOString() })
    .where(eq(automations.id, automationId))
    .run();
}

export async function startScheduler(db: Db): Promise<() => void> {
  await loadBuiltinRecipes();

  let allAutomations: (typeof automations.$inferSelect)[] = [];
  try {
    allAutomations = db
      .select()
      .from(automations)
      .all()
      .filter((a) => a.enabled === 1);
  } catch {
    return stopScheduler;
  }

  for (const automation of allAutomations) {
    if (!validate(automation.cron)) continue;

    const task = schedule(automation.cron, async () => {
      try {
        await runAutomation(db, automation.id);
      } catch (_) {}
    });

    jobs.set(automation.id, task);
  }

  return stopScheduler;
}

export function stopScheduler(): void {
  for (const task of jobs.values()) {
    task.stop();
  }
  jobs.clear();
}

let _recipesLoaded = false;

export async function loadBuiltinRecipes(): Promise<void> {
  if (_recipesLoaded) return;
  const { githubIssuesHandler } = await import("./recipes/github-issues");
  registerRecipe("github_issues", githubIssuesHandler);
  _recipesLoaded = true;
}
