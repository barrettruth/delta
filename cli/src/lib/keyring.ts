import {
  chmodSync,
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { credentialsPath, ensureConfigDir } from "./paths.js";

interface CredentialsFile {
  token: string;
}

export function getToken(): string | null {
  if (process.env.DELTA_TOKEN) {
    return process.env.DELTA_TOKEN;
  }

  if (!existsSync(credentialsPath)) {
    return null;
  }

  const raw = readFileSync(credentialsPath, "utf-8");
  const data = JSON.parse(raw) as CredentialsFile;
  return data.token ?? null;
}

export function setToken(token: string): void {
  ensureConfigDir();
  const data: CredentialsFile = { token };
  writeFileSync(credentialsPath, JSON.stringify(data, null, 2), {
    mode: 0o600,
  });
  chmodSync(credentialsPath, 0o600);
}

export function clearToken(): void {
  if (existsSync(credentialsPath)) {
    unlinkSync(credentialsPath);
  }
}
