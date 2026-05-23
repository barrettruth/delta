import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../cli/src/program";

type RequestRecord = {
  init?: RequestInit;
  url: URL;
};

function installCliHarness() {
  const requests: RequestRecord[] = [];
  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url, init });

    if (url.pathname.startsWith("/api/export/ical")) {
      return new Response("BEGIN:VCALENDAR\nEND:VCALENDAR\n");
    }

    return Response.json([]);
  });

  vi.stubEnv("DELTA_TOKEN", "test-token");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  return { fetchMock, requests };
}

async function runCli(args: string[]) {
  const program = createProgram("0.0.0");
  program.exitOverride();
  await program.parseAsync(["node", "delta", ...args]);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Delta CLI program", () => {
  it("passes task list filters and keeps the pending default", async () => {
    const { requests } = installCliHarness();

    await runCli([
      "--server",
      "http://delta.test",
      "task",
      "list",
      "status:wip",
      "--json",
    ]);
    await runCli(["--server", "http://delta.test", "task", "list", "--json"]);

    expect(requests.map((request) => request.url.pathname)).toEqual([
      "/api/tasks",
      "/api/tasks",
    ]);
    expect(requests[0].url.searchParams.get("status")).toBe("wip");
    expect(requests[1].url.searchParams.get("status")).toBe("pending");
  });

  it("uses the same task list path for bare delta and bare task defaults", async () => {
    const { requests } = installCliHarness();

    await runCli(["--server", "http://delta.test", "--json"]);
    await runCli([
      "--server",
      "http://delta.test",
      "task",
      "status:wip",
      "--json",
    ]);

    expect(requests.map((request) => request.url.href)).toEqual([
      "http://delta.test/api/tasks?status=pending",
      "http://delta.test/api/tasks?status=wip",
    ]);
  });

  it("lets the global server flag override DELTA_SERVER", async () => {
    const { requests } = installCliHarness();
    vi.stubEnv("DELTA_SERVER", "http://env.test");

    await runCli(["task", "list", "--json"]);
    await runCli(["--server", "http://flag.test", "task", "list", "--json"]);

    expect(requests.map((request) => request.url.origin)).toEqual([
      "http://env.test",
      "http://flag.test",
    ]);
  });

  it("passes export filters as iCal query params", async () => {
    const { requests } = installCliHarness();

    await runCli([
      "--server",
      "http://delta.test",
      "export",
      "status:wip",
      "category:work",
    ]);

    expect(requests).toHaveLength(1);
    expect(requests[0].url.href).toBe(
      "http://delta.test/api/export/ical?status=wip&category=work",
    );
  });
});
