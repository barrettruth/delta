import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "smol-toml";
import { configPath, ensureConfigDir } from "./paths.js";

export interface DeltaConfig {
  server?: string;
}

export const DEFAULT_SERVER = "https://delta.barrettruth.com";

export function readConfig(): DeltaConfig {
  const config: DeltaConfig = {};

  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = parse(raw);
    if (typeof parsed.server === "string") {
      config.server = parsed.server;
    }
  }

  if (process.env.DELTA_SERVER) {
    config.server = process.env.DELTA_SERVER;
  }

  return config;
}

export function writeConfig(config: DeltaConfig): void {
  ensureConfigDir();
  const toml = stringify(config as Record<string, unknown>);
  writeFileSync(configPath, toml, { mode: 0o644 });
}
