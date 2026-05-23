import type { Command } from "commander";
import { createClient } from "./lib/client.js";
import { parseDate } from "./lib/dates.js";
import { parseFilters } from "./lib/filters.js";

export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description("Export events as iCal")
    .argument("[filters...]", "Filter expressions")
    .option("--from <date>", "Due date lower bound")
    .option("--until <date>", "Due date upper bound")
    .option("--id <id>", "Export single event by ID")
    .allowUnknownOption(false)
    .action(
      async (
        filterArgs: string[] | undefined,
        opts: Record<string, string>,
      ) => {
        const client = createClient();

        if (opts.id) {
          const ical = await client.getRaw(`/api/export/ical/${opts.id}`);
          process.stdout.write(ical);
          return;
        }

        const filters = parseFilters(filterArgs ?? []);
        const params: Record<string, string> = {};

        if (opts.from) params.from = parseDate(opts.from);
        if (opts.until) params.to = parseDate(opts.until);
        if (filters.status) params.status = filters.status.value;
        if (filters.category) params.category = filters.category.value;

        const ical = await client.getRaw("/api/export/ical", params);
        process.stdout.write(ical);
      },
    );
}
