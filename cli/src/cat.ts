import type { Command } from "commander";
import { createClient } from "./lib/client.js";
import { print } from "./lib/output.js";

interface CategoryRow {
  name: string;
  count: number;
}

export function registerCatCommand(cat: Command): void {
  cat.action(async () => {
    const client = createClient();
    const rows = await client.get<CategoryRow[]>("/api/categories");
    print(rows, { columns: ["name", "count"] });
  });
}
