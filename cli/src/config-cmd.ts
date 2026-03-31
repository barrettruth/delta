import type { Command } from "commander";
import { readConfig, writeConfig } from "./lib/config.js";

export function registerConfigCommands(config: Command): void {
  config
    .command("get")
    .description("Get a setting value")
    .argument("<key>", "Config key")
    .action((key: string) => {
      const cfg = readConfig() as Record<string, unknown>;
      const value = cfg[key];
      if (value === undefined) {
        process.stderr.write(`Key not set: ${key}\n`);
        process.exit(3);
      }
      process.stdout.write(`${value}\n`);
    });

  config
    .command("set")
    .description("Set a setting value")
    .argument("<key>", "Config key")
    .argument("<value>", "Config value")
    .action((key: string, value: string) => {
      const cfg = readConfig() as Record<string, unknown>;
      cfg[key] = value;
      writeConfig(cfg);
      process.stdout.write(`${key} = ${value}\n`);
    });

  config.action(() => {
    const cfg = readConfig() as Record<string, unknown>;
    const entries = Object.entries(cfg);
    if (entries.length === 0) {
      process.stdout.write("No config set\n");
      return;
    }
    for (const [key, value] of entries) {
      process.stdout.write(`${key} = ${value}\n`);
    }
  });
}
