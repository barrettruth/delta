import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse, stringify } from "smol-toml";

export interface DeltaConfig {
  server?: string;
}

function configDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return join(home, ".config", "delta");
}

function configPath(): string {
  return join(configDir(), "config.toml");
}

export function readConfig(): DeltaConfig {
  const path = configPath();
  const config: DeltaConfig = {};

  if (existsSync(path)) {
    const raw = readFileSync(path, "utf-8");
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
  const path = configPath();
  const dir = dirname(path);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const toml = stringify(config as Record<string, unknown>);
  writeFileSync(path, toml, { mode: 0o644 });
}
