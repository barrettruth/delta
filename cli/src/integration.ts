import type { Command } from "commander";
import { createClient } from "./lib/client.js";
import { print } from "./lib/output.js";

interface IntegrationConfig {
  id: number;
  provider: string;
  enabled: number;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TestResult {
  valid: boolean;
  error?: string;
}

export function registerIntegrationCommands(integration: Command): void {
  integration
    .command("list")
    .description("List configured integrations")
    .action(async () => {
      const client = createClient();
      const rows = await client.get<IntegrationConfig[]>(
        "/api/settings/integrations",
      );
      print(rows, { columns: ["id", "provider", "enabled"] });
    });

  integration
    .command("test")
    .description("Test integration API key")
    .argument("<provider>", "Integration provider")
    .option("--api-key <key>", "API key to test")
    .option("--model <model>", "Model override")
    .action(
      async (provider: string, opts: { apiKey?: string; model?: string }) => {
        const client = createClient();
        const body: Record<string, unknown> = { provider };
        if (opts.apiKey) body.apiKey = opts.apiKey;
        if (opts.model) body.model = opts.model;

        const result = await client.post<TestResult>(
          "/api/settings/integrations/test",
          body,
        );
        if (result.valid) {
          process.stdout.write(`${provider}: valid\n`);
        } else {
          process.stderr.write(`${provider}: ${result.error ?? "invalid"}\n`);
          process.exit(1);
        }
      },
    );

  integration.action(() => {
    integration.commands.find((c) => c.name() === "list")?.parse(process.argv);
  });
}
