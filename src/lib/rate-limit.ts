const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const attempts = new Map<string, number[]>();

function cleanup() {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, timestamps] of attempts) {
    const valid = timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) {
      attempts.delete(ip);
    } else {
      attempts.set(ip, valid);
    }
  }
}

const _global = globalThis as Record<string, unknown>;

if (
  typeof globalThis !== "undefined" &&
  !("__rateLimitCleanup" in globalThis)
) {
  const interval = setInterval(cleanup, CLEANUP_INTERVAL_MS);
  if (typeof interval.unref === "function") {
    interval.unref();
  }
  _global.__rateLimitCleanup = interval;
}

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const timestamps = (attempts.get(ip) ?? []).filter((t) => t > cutoff);
  attempts.set(ip, timestamps);
  return timestamps.length >= MAX_ATTEMPTS;
}

export function recordAttempt(ip: string): void {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const timestamps = (attempts.get(ip) ?? []).filter((t) => t > cutoff);
  timestamps.push(now);
  attempts.set(ip, timestamps);
}

export function resetForTesting(): void {
  attempts.clear();
}
