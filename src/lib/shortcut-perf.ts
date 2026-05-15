export interface ShortcutPerfEntry {
  id: string;
  action: string;
  key?: string;
  startedAt: number;
  visibleAt?: number;
  settledAt?: number;
  visibleMs?: number;
  settledMs?: number;
}

export interface ShortcutPerfStore {
  entries: ShortcutPerfEntry[];
  clear: () => void;
}

export interface ShortcutPerfTracker {
  entry: ShortcutPerfEntry;
  markVisible: () => void;
  markVisibleAfterFrame: () => void;
  markSettled: () => void;
  markSettledAfterFrame: () => void;
}

declare global {
  interface Window {
    __deltaShortcutPerf?: ShortcutPerfStore;
  }
}

let metricSeq = 0;

function now(): number {
  if (typeof performance !== "undefined") return performance.now();
  return Date.now();
}

function afterFrame(callback: () => void) {
  if (typeof requestAnimationFrame === "undefined") {
    queueMicrotask(callback);
    return;
  }
  requestAnimationFrame(() => {
    setTimeout(callback, 0);
  });
}

function shortcutPerfStore(): ShortcutPerfStore | null {
  if (typeof window === "undefined") return null;
  if (!window.__deltaShortcutPerf) {
    window.__deltaShortcutPerf = {
      entries: [],
      clear() {
        this.entries.splice(0, this.entries.length);
      },
    };
  }
  return window.__deltaShortcutPerf;
}

function mark(entry: ShortcutPerfEntry, field: "visibleAt" | "settledAt") {
  if (entry[field] !== undefined) return;
  const at = now();
  entry[field] = at;
  if (field === "visibleAt") entry.visibleMs = at - entry.startedAt;
  if (field === "settledAt") entry.settledMs = at - entry.startedAt;
}

export function startShortcutPerf(
  action: string,
  key?: string,
): ShortcutPerfTracker {
  const entry: ShortcutPerfEntry = {
    id: `${Date.now()}-${metricSeq++}`,
    action,
    key,
    startedAt: now(),
  };

  shortcutPerfStore()?.entries.push(entry);

  return {
    entry,
    markVisible() {
      mark(entry, "visibleAt");
    },
    markVisibleAfterFrame() {
      afterFrame(() => mark(entry, "visibleAt"));
    },
    markSettled() {
      mark(entry, "settledAt");
    },
    markSettledAfterFrame() {
      afterFrame(() => mark(entry, "settledAt"));
    },
  };
}

export function shortcutPerfStats(
  entries: readonly ShortcutPerfEntry[],
  field: "visibleMs" | "settledMs",
): { count: number; min: number; p50: number; p95: number; max: number } {
  const values = entries
    .map((entry) => entry[field])
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return { count: 0, min: 0, p50: 0, p95: 0, max: 0 };
  }

  const percentile = (p: number) => {
    const index = Math.min(
      values.length - 1,
      Math.ceil((p / 100) * values.length) - 1,
    );
    return values[index];
  };

  return {
    count: values.length,
    min: values[0],
    p50: percentile(50),
    p95: percentile(95),
    max: values[values.length - 1],
  };
}
