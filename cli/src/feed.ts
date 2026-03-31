import type { Command } from "commander";
import { createClient, getServerUrl } from "./lib/client.js";

interface FeedResponse {
  token: string | null;
}

function feedUrl(token: string): string {
  return `${getServerUrl()}/api/calendar/feed/${token}`;
}

export function registerFeedCommands(program: Command): void {
  const feed = program
    .command("feed")
    .description("iCal feed management")
    .action(async () => {
      const client = createClient();
      const result = await client.get<FeedResponse>("/api/calendar/feed");

      if (result.token) {
        process.stdout.write(`${feedUrl(result.token)}\n`);
      } else {
        process.stderr.write("no feed configured\n");
      }
    });

  feed
    .command("generate")
    .description("Generate/regenerate iCal feed URL")
    .action(async () => {
      const client = createClient();
      const result = await client.post<FeedResponse>("/api/calendar/feed");
      process.stdout.write(`${feedUrl(result.token as string)}\n`);
    });

  feed
    .command("revoke")
    .description("Revoke iCal feed URL")
    .action(async () => {
      const client = createClient();
      await client.delete("/api/calendar/feed");
      process.stdout.write("feed revoked\n");
    });
}
