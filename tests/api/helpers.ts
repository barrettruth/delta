import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, vi } from "vitest";
import type { SafeUser } from "@/core/auth";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

export type ApiRouteTestState = {
  db: Db;
  user: SafeUser;
};

type AuthMode = "local-owner" | "request";

type ApiRouteHarnessOptions = {
  auth?: AuthMode;
  restoreMocks?: boolean;
  stubFetch?: boolean;
  unstubGlobals?: boolean;
  username: string;
};

export function installApiRouteTestHarness(
  state: ApiRouteTestState,
  options: ApiRouteHarnessOptions,
) {
  mockApiRouteDb(state);
  mockApiRouteAuth(state, options.auth ?? "request");

  const encryptionKey = randomBytes(32).toString("hex");

  beforeEach(() => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", encryptionKey);
    if (options.stubFetch) {
      vi.stubGlobal("fetch", vi.fn());
    }
    state.db = createTestDb();
    state.user = createTestUser(state.db, options.username);
  });

  afterEach(() => {
    vi.resetModules();
    if (options.restoreMocks) {
      vi.restoreAllMocks();
    }
    vi.unstubAllEnvs();
    if (options.stubFetch || options.unstubGlobals) {
      vi.unstubAllGlobals();
    }
  });
}

export function apiRequest(pathOrUrl: string, init?: RequestInit): Request {
  return new Request(apiUrl(pathOrUrl), init);
}

export function jsonRequest(
  pathOrUrl: string,
  body: unknown,
  init?: RequestInit,
): Request {
  return apiRequest(pathOrUrl, {
    method: "POST",
    ...init,
    body: JSON.stringify(body),
  });
}

export async function responseJson<T = Record<string, unknown>>(
  response: Response,
) {
  return response.json() as Promise<T>;
}

function mockApiRouteDb(state: ApiRouteTestState) {
  vi.doMock("@/db", () => ({
    get db() {
      return state.db;
    },
  }));
}

function mockApiRouteAuth(state: ApiRouteTestState, mode: AuthMode) {
  vi.doMock("@/lib/auth-responses", () => ({
    unauthorized: () =>
      Response.json({ error: "Unauthorized" }, { status: 401 }),
  }));

  if (mode === "local-owner") {
    vi.doMock("@/lib/local-owner", () => ({
      getLocalOwner: vi.fn(async () => state.user),
    }));
    return;
  }

  vi.doMock("@/lib/request-auth", () => ({
    getApiKeyUserOrLocalOwnerFromRequest: vi.fn(async () => state.user),
  }));
}

function apiUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  return `http://delta.test${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}
