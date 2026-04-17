import { taskDependencies } from "@/db/schema";
import type { UrgencyWeights } from "./settings";
import type { Db, Task } from "./types";

const DEFAULT_WEIGHTS = {
  due: 12.0,
  age: 2.0,
  wip: 4.0,
  blocking: 8.0,
  blocked: -100.0,
};

function dueCoefficient(due: string | null, now: Date): number {
  if (!due) return 0;
  const daysRemaining = (new Date(due).getTime() - now.getTime()) / 86400000;
  if (daysRemaining < 0) return 1.0;
  if (daysRemaining < 1) return 0.9;
  if (daysRemaining < 2) return 0.7;
  if (daysRemaining < 7) return 0.5 - (daysRemaining - 2) * 0.06;
  if (daysRemaining < 14) return 0.2 - (daysRemaining - 7) * 0.015;
  return 0.1;
}

function ageCoefficient(createdAt: string, now: Date): number {
  const daysOld = (now.getTime() - new Date(createdAt).getTime()) / 86400000;
  return Math.min(daysOld / 365, 1.0);
}

export function computeUrgency(
  task: Task,
  blockingCount: number,
  isBlocked: boolean,
  customWeights?: Partial<UrgencyWeights>,
): number {
  if (task.status === "done" || task.status === "cancelled") return 0;

  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };
  const now = new Date();
  let score = 0;

  score += weights.due * dueCoefficient(task.due, now);
  score += weights.age * ageCoefficient(task.createdAt, now);

  if (task.status === "wip") score += weights.wip;
  if (isBlocked) score += DEFAULT_WEIGHTS.blocked;

  score += weights.blocking * blockingCount;

  return Math.round(score * 10) / 10;
}

export interface RankedTask extends Task {
  urgency: number;
}

export function rankTasks(
  db: Db,
  tasks: Task[],
  customWeights?: Partial<UrgencyWeights>,
): RankedTask[] {
  const allDeps = db.select().from(taskDependencies).all();

  const blockingCounts = new Map<number, number>();
  const blockedSet = new Set<number>();

  for (const dep of allDeps) {
    blockingCounts.set(
      dep.dependsOnId,
      (blockingCounts.get(dep.dependsOnId) ?? 0) + 1,
    );
    blockedSet.add(dep.taskId);
  }

  return tasks
    .map((task) => ({
      ...task,
      urgency: computeUrgency(
        task,
        blockingCounts.get(task.id) ?? 0,
        blockedSet.has(task.id),
        customWeights,
      ),
    }))
    .filter((t) => t.status !== "done" && t.status !== "cancelled")
    .sort((a, b) => b.urgency - a.urgency);
}
