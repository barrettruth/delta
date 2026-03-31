import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const home = process.env.HOME ?? process.env.USERPROFILE ?? "";

export const configDir = process.env.XDG_CONFIG_HOME
  ? join(process.env.XDG_CONFIG_HOME, "delta")
  : join(home, ".config", "delta");

export const dataDir = process.env.XDG_DATA_HOME
  ? join(process.env.XDG_DATA_HOME, "delta")
  : join(home, ".local", "share", "delta");

export const configPath = join(configDir, "config.toml");
export const credentialsPath = join(dataDir, "credentials.json");

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function ensureConfigDir(): void {
  ensureDir(configDir);
}

export function ensureDataDir(): void {
  ensureDir(dataDir);
}
