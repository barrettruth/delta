import { afterEach, describe, expect, it, vi } from "vitest";
import { shortcutPerfStats, startShortcutPerf } from "@/lib/shortcut-perf";

describe("shortcut perf helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records visible and settled timing separately", () => {
    let now = 100;
    vi.stubGlobal("performance", { now: () => now });
    vi.stubGlobal("window", {});

    const metric = startShortcutPerf("settings", "S");

    now = 118;
    metric.markVisible();
    now = 240;
    metric.markSettled();

    expect(window.__deltaShortcutPerf?.entries).toEqual([
      expect.objectContaining({
        action: "settings",
        key: "S",
        visibleMs: 18,
        settledMs: 140,
      }),
    ]);
  });

  it("summarizes p95 without letting missing measurements count", () => {
    expect(
      shortcutPerfStats(
        [
          { id: "1", action: "a", startedAt: 0, visibleMs: 10 },
          { id: "2", action: "a", startedAt: 0, visibleMs: 40 },
          { id: "3", action: "a", startedAt: 0 },
        ],
        "visibleMs",
      ),
    ).toEqual({
      count: 2,
      min: 10,
      p50: 10,
      p95: 40,
      max: 40,
    });
  });
});
