import type { Command } from "commander";
import { createClient } from "./lib/client.js";
import { print } from "./lib/output.js";

interface Automation {
  id: number;
  name: string;
  cron: string;
  type: string;
  config: string;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

export function registerCronCommands(cron: Command): void {
  cron
    .command("list")
    .description("List automations")
    .action(async () => {
      const client = createClient();
      const rows = await client.get<Automation[]>("/api/automations");
      print(rows, {
        columns: ["id", "name", "cron", "type", "enabled"],
      });
    });

  cron
    .command("add")
    .description("Create automation")
    .option("--name <name>", "Automation name")
    .option("--schedule <cron-expr>", "Cron expression")
    .option("--type <type>", "Recipe type (github_issues, webhook, custom)")
    .option("--config <json>", "JSON config blob")
    .action(
      async (opts: {
        name?: string;
        schedule?: string;
        type?: string;
        config?: string;
      }) => {
        const client = createClient();
        let config: unknown = opts.config;
        if (typeof config === "string") {
          try {
            config = JSON.parse(config);
          } catch {}
        }

        const created = await client.post<Automation>("/api/automations", {
          name: opts.name,
          cron: opts.schedule,
          type: opts.type,
          config,
        });
        process.stdout.write(`created #${created.id} ${created.name}\n`);
      },
    );

  cron
    .command("edit")
    .description("Update automation")
    .argument("<id>", "Automation ID")
    .option("--name <name>", "Automation name")
    .option("--schedule <cron-expr>", "Cron expression")
    .option("--type <type>", "Recipe type")
    .option("--config <json>", "JSON config blob")
    .action(
      async (
        id: string,
        opts: {
          name?: string;
          schedule?: string;
          type?: string;
          config?: string;
        },
      ) => {
        const client = createClient();
        const body: Record<string, unknown> = {};
        if (opts.name !== undefined) body.name = opts.name;
        if (opts.schedule !== undefined) body.cron = opts.schedule;
        if (opts.type !== undefined) body.type = opts.type;
        if (opts.config !== undefined) {
          try {
            body.config = JSON.parse(opts.config);
          } catch {
            body.config = opts.config;
          }
        }

        await client.patch(`/api/automations/${id}`, body);
        process.stdout.write(`updated #${id}\n`);
      },
    );

  cron
    .command("delete")
    .description("Delete automation")
    .argument("<id>", "Automation ID")
    .action(async (id: string) => {
      const client = createClient();
      await client.delete(`/api/automations/${id}`);
      process.stdout.write(`deleted #${id}\n`);
    });

  cron
    .command("run")
    .description("Trigger automation manually")
    .argument("<id>", "Automation ID")
    .action(async (id: string) => {
      const client = createClient();
      await client.post(`/api/automations/${id}/run`);
      process.stdout.write(`triggered #${id}\n`);
    });

  cron
    .command("enable")
    .description("Enable automation")
    .argument("<id>", "Automation ID")
    .action(async (id: string) => {
      const client = createClient();
      await client.patch(`/api/automations/${id}`, { enabled: 1 });
      process.stdout.write(`enabled #${id}\n`);
    });

  cron
    .command("disable")
    .description("Disable automation")
    .argument("<id>", "Automation ID")
    .action(async (id: string) => {
      const client = createClient();
      await client.patch(`/api/automations/${id}`, { enabled: 0 });
      process.stdout.write(`disabled #${id}\n`);
    });

  cron.action(() => {
    cron.commands.find((c) => c.name() === "list")?.parse(process.argv);
  });
}
