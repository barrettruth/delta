import type { Command } from "commander";
import { createClient } from "./lib/client.js";
import { print } from "./lib/output.js";

interface Invite {
  id: number;
  code: string;
  createdAt: string;
  usedAt: string | null;
}

export function registerInviteCommands(invite: Command): void {
  invite
    .command("list")
    .description("List invite links")
    .action(async () => {
      const client = createClient();
      const rows = await client.get<Invite[]>("/api/invites");
      print(rows, { columns: ["id", "code", "createdAt", "usedAt"] });
    });

  invite
    .command("create")
    .description("Generate invite link")
    .action(async () => {
      const client = createClient();
      const created = await client.post<Invite>("/api/invites");
      process.stdout.write(`${created.code}\n`);
    });

  invite.action(() => {
    invite.commands.find((c) => c.name() === "list")?.parse(process.argv);
  });
}
