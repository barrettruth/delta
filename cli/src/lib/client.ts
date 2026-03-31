import { readConfig } from "./config.js";
import { getToken } from "./keyring.js";

export class DeltaClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DeltaClientError";
  }
}

interface RequestOptions {
  params?: Record<string, string>;
  body?: unknown;
}

let debugEnabled = false;

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

export class DeltaClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.token = token;
  }

  private async request<T>(
    method: string,
    path: string,
    opts?: RequestOptions,
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    if (opts?.params) {
      const searchParams = new URLSearchParams(opts.params);
      const qs = searchParams.toString();
      if (qs) {
        url += `?${qs}`;
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    };

    const init: RequestInit = { method, headers };

    if (opts?.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }

    if (debugEnabled) {
      process.stderr.write(`> ${method} ${url}\n`);
      if (opts?.body) {
        process.stderr.write(`> ${JSON.stringify(opts.body)}\n`);
      }
    }

    const res = await fetch(url, init);

    if (debugEnabled) {
      process.stderr.write(`< ${res.status} ${res.statusText}\n`);
    }

    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const err = (await res.json()) as { error?: string };
        if (err.error) message = err.error;
      } catch {}
      throw new DeltaClientError(res.status, message);
    }

    const text = await res.text();
    if (!text) return undefined as T;

    const data = JSON.parse(text) as T;

    if (debugEnabled) {
      process.stderr.write(`< ${JSON.stringify(data)}\n`);
    }

    return data;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, { params });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, { body });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, { body });
  }

  async delete<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>("DELETE", path, { params });
  }
}

export function createClient(): DeltaClient {
  const config = readConfig();
  const token = getToken();

  const server = config.server ?? "https://delta.barrettruth.com";

  if (!token) {
    throw new Error("Not authenticated. Run `delta auth login` first.");
  }

  return new DeltaClient(server, token);
}
