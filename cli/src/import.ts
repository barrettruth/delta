import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { createClient } from "./lib/client.js";

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

export function registerImportCommand(program: Command): void {
  program
    .command("import")
    .description("Import iCal file")
    .argument("<file>", "Path to .ics file")
    .option("-c, --category <name>", "Category for imported events")
    .action(async (file: string, opts: { category?: string }) => {
      const client = createClient();

      const content = readFileSync(file);
      const blob = new Blob([content], { type: "text/calendar" });

      const formData = new FormData();
      formData.set("file", blob, file.split("/").pop() ?? "import.ics");
      if (opts.category) {
        formData.set("category", opts.category);
      }

      const result = await client.postFormData<ImportResult>(
        "/api/import/ical",
        formData,
      );

      process.stdout.write(`imported ${result.created} events`);
      if (result.skipped > 0) {
        process.stdout.write(`, ${result.skipped} skipped`);
      }
      if (result.errors.length > 0) {
        process.stdout.write(`, ${result.errors.length} errors`);
      }
      process.stdout.write("\n");
    });
}
