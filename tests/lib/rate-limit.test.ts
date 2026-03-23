import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isRateLimited,
  recordAttempt,
  resetForTesting,
} from "@/lib/rate-limit";

beforeEach(() => {
  resetForTesting();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rate limiter", () => {
  it("allows requests under the limit", () => {
    for (let i = 0; i < 5; i++) {
      recordAttempt("1.2.3.4");
    }
    expect(isRateLimited("1.2.3.4")).toBe(true);
  });

  it("blocks after 5 attempts", () => {
    for (let i = 0; i < 5; i++) {
      recordAttempt("1.2.3.4");
    }
    expect(isRateLimited("1.2.3.4")).toBe(true);
  });

  it("allows requests from different IPs independently", () => {
    for (let i = 0; i < 5; i++) {
      recordAttempt("1.2.3.4");
    }
    expect(isRateLimited("1.2.3.4")).toBe(true);
    expect(isRateLimited("5.6.7.8")).toBe(false);
  });

  it("allows fewer than 5 attempts", () => {
    for (let i = 0; i < 4; i++) {
      recordAttempt("1.2.3.4");
    }
    expect(isRateLimited("1.2.3.4")).toBe(false);
  });

  it("resets after window expires", () => {
    vi.useFakeTimers();

    for (let i = 0; i < 5; i++) {
      recordAttempt("1.2.3.4");
    }
    expect(isRateLimited("1.2.3.4")).toBe(true);

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    expect(isRateLimited("1.2.3.4")).toBe(false);
  });

  it("is not limited for unknown IPs", () => {
    expect(isRateLimited("9.9.9.9")).toBe(false);
  });
});
