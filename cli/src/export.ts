import type { Command } from "commander";
import { createClient } from "./lib/client.js";
import { parseDate } from "./lib/dates.js";
import { parseFilters } from "./lib/filters.js";

export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description("Export events as iCal")
    .option("--from <date>", "Start date filter")
    .option("--until <date>", "End date filter")
    .option("--id <id>", "Export single event by ID")
    .allowUnknownOption(false)
    .action(async (opts: Record<string, string>, cmd: Command) => {
      const client = createClient();

      if (opts.id) {
        const ical = await client.getRaw(`/api/export/ical/${opts.id}`);
        process.stdout.write(ical);
        return;
      }

      const remaining = cmd.args;
      const filters = parseFilters(remaining);
      const params: Record<string, string> = {};

      if (opts.from) params.from = parseDate(opts.from);
      if (opts.until) params.to = parseDate(opts.until);
      if (filters.status) params.status = filters.status.value;
      if (filters.category) params.category = filters.category.value;

      const ical = await client.getRaw("/api/export/ical", params);
      process.stdout.write(ical);
    });
}
