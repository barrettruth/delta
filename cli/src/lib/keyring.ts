import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

interface CredentialsFile {
  token: string;
}

function credentialsPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return join(home, ".config", "delta", "credentials.json");
}

export function getToken(): string | null {
  if (process.env.DELTA_TOKEN) {
    return process.env.DELTA_TOKEN;
  }

  const path = credentialsPath();
  if (!existsSync(path)) {
    return null;
  }

  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw) as CredentialsFile;
  return data.token ?? null;
}

export function setToken(token: string): void {
  const path = credentialsPath();
  const dir = dirname(path);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const data: CredentialsFile = { token };
  writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function clearToken(): void {
  const path = credentialsPath();
  if (existsSync(path)) {
    unlinkSync(path);
  }
}
