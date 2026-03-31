import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const home = process.env.HOME ?? process.env.USERPROFILE ?? "";

export const configDir = join(home, ".config", "delta");
export const configPath = join(configDir, "config.toml");
export const credentialsPath = join(configDir, "credentials.json");

export function ensureConfigDir(): void {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}
