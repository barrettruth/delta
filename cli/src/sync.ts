import type { Command } from "commander";
import { createClient } from "./lib/client.js";

interface SyncResult {
  pulled: number;
  pushed: number;
}

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Trigger Google Calendar sync")
    .action(async () => {
      const client = createClient();
      const result = await client.post<SyncResult>("/api/calendar/sync");
      process.stdout.write(
        `sync complete: ${result.pulled} pulled, ${result.pushed} pushed\n`,
      );
    });
}
