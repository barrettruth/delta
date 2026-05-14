import { and, eq, inArray } from "drizzle-orm";
import { GOOGLE_TASKS_LINK_PROVIDER } from "@/core/google/types";
import { deleteIntegrationConfig } from "@/core/integration-config";
import type { Db } from "@/core/types";
import { syncSources, taskExternalLinks, tasks } from "@/db/schema";
import { GOOGLE_PROVIDER } from "./types";

export function disconnectGoogleIntegration(db: Db, userId: number): void {
  db.transaction((tx) => {
    const txDb = tx as Db;
    const googleTaskLinks = txDb
      .select({ taskId: taskExternalLinks.taskId })
      .from(taskExternalLinks)
      .where(
        and(
          eq(taskExternalLinks.userId, userId),
          eq(taskExternalLinks.provider, GOOGLE_TASKS_LINK_PROVIDER),
        ),
      )
      .all();
    const taskIds = googleTaskLinks.map((link) => link.taskId);

    if (taskIds.length > 0) {
      txDb.delete(tasks).where(inArray(tasks.id, taskIds)).run();
    }

    txDb
      .delete(syncSources)
      .where(
        and(
          eq(syncSources.userId, userId),
          eq(syncSources.provider, GOOGLE_PROVIDER),
        ),
      )
      .run();

    deleteIntegrationConfig(txDb, userId, GOOGLE_PROVIDER);
  });
}
