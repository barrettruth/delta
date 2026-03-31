import type { Command } from "commander";
import { createClient } from "./lib/client.js";

interface ShareResponse {
  token: string;
  url: string;
}

export function registerShareCommand(share: Command): void {
  share.argument("<task-id>", "Task ID").action(async (taskId: string) => {
    const client = createClient();
    const result = await client.post<ShareResponse>(
      `/api/events/${taskId}/share`,
    );
    process.stdout.write(`${result.url}\n`);
  });
}
