import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeInput,
  parseRecurrence,
  parseRecurrenceLlm,
  parseRecurrenceLocal,
  validateRRule,
} from "@/core/nlp-recurrence";

describe("normalizeInput", () => {
  it("converts 'daily' to 'every day'", () => {
    expect(normalizeInput("daily")).toBe("every day");
  });

  it("converts 'weekly' to 'every week'", () => {
    expect(normalizeInput("weekly")).toBe("every week");
  });

  it("converts 'monthly' to 'every month'", () => {
    expect(normalizeInput("monthly")).toBe("every month");
  });

  it("converts 'yearly' to 'every year'", () => {
    expect(normalizeInput("yearly")).toBe("every year");
  });

  it("converts 'annually' to 'every year'", () => {
    expect(normalizeInput("annually")).toBe("every year");
  });

  it("converts 'biweekly' to 'every 2 weeks'", () => {
    expect(normalizeInput("biweekly")).toBe("every 2 weeks");
  });

  it("converts 'bi-weekly' to 'every 2 weeks'", () => {
    expect(normalizeInput("bi-weekly")).toBe("every 2 weeks");
  });

  it("converts 'fortnightly' to 'every 2 weeks'", () => {
    expect(normalizeInput("fortnightly")).toBe("every 2 weeks");
  });

  it("converts 'bimonthly' to 'every 2 months'", () => {
    expect(normalizeInput("bimonthly")).toBe("every 2 months");
  });

  it("converts 'quarterly' to 'every 3 months'", () => {
    expect(normalizeInput("quarterly")).toBe("every 3 months");
  });

  it("converts 'weekdays' to 'every weekday'", () => {
    expect(normalizeInput("weekdays")).toBe("every weekday");
  });

  it("converts 'mwf' to monday, wednesday, and friday", () => {
    expect(normalizeInput("mwf")).toBe("every monday, wednesday, and friday");
  });

  it("converts 'tth' to tuesday and thursday", () => {
    expect(normalizeInput("tth")).toBe("every tuesday and thursday");
  });

  it("converts 'mw' to monday and wednesday", () => {
    expect(normalizeInput("mw")).toBe("every monday and wednesday");
  });

  it("converts 'every other week' to 'every 2 week'", () => {
    expect(normalizeInput("every other week")).toBe("every 2 week");
  });

  it("converts 'every other day' to 'every 2 day'", () => {
    expect(normalizeInput("every other day")).toBe("every 2 day");
  });

  it("converts 'every other monday' to 'every 2 monday'", () => {
    expect(normalizeInput("every other monday")).toBe("every 2 monday");
  });

  it("passes through already-valid rrule NLP strings", () => {
    expect(normalizeInput("every 3 weeks")).toBe("every 3 weeks");
  });

  it("trims whitespace", () => {
    expect(normalizeInput("  daily  ")).toBe("every day");
  });

  it("is case-insensitive", () => {
    expect(normalizeInput("DAILY")).toBe("every day");
    expect(normalizeInput("Weekly")).toBe("every week");
    expect(normalizeInput("MWF")).toBe("every monday, wednesday, and friday");
  });
});

describe("parseRecurrenceLocal", () => {
  it("parses 'every day' to a daily RRULE", () => {
    const result = parseRecurrenceLocal("every day");
    expect(result).not.toBeNull();
    expect(result?.rrule).toContain("FREQ=DAILY");
    expect(result?.source).toBe("local");
    expect(result?.humanText).toBe("every day");
  });

  it("parses 'daily' through normalization", () => {
    const result = parseRecurrenceLocal("daily");
    expect(result).not.toBeNull();
    expect(result?.rrule).toContain("FREQ=DAILY");
  });

  it("parses 'weekly' through normalization", () => {
    const result = parseRecurrenceLocal("weekly");
    expect(result).not.toBeNull();
    expect(result?.rrule).toContain("FREQ=WEEKLY");
  });

  it("parses 'biweekly' to every 2 weeks", () => {
    const result = parseRecurrenceLocal("biweekly");
    expect(result).not.toBeNull();
    expect(result?.rrule).toContain("FREQ=WEEKLY");
    expect(result?.rrule).toContain("INTERVAL=2");
  });

  it("parses 'mwf' to weekly on mon/wed/fri", () => {
    const result = parseRecurrenceLocal("mwf");
    expect(result).not.toBeNull();
    expect(result?.rrule).toContain("FREQ=WEEKLY");
    expect(result?.rrule).toContain("MO");
    expect(result?.rrule).toContain("WE");
    expect(result?.rrule).toContain("FR");
  });

  it("parses 'every weekday'", () => {
    const result = parseRecurrenceLocal("weekdays");
    expect(result).not.toBeNull();
    expect(result?.rrule).toContain("FREQ=WEEKLY");
    expect(result?.rrule).toContain("MO");
    expect(result?.rrule).toContain("FR");
    expect(result?.rrule).not.toContain("SA");
    expect(result?.rrule).not.toContain("SU");
  });

  it("parses 'quarterly' to every 3 months", () => {
    const result = parseRecurrenceLocal("quarterly");
    expect(result).not.toBeNull();
    expect(result?.rrule).toContain("FREQ=MONTHLY");
    expect(result?.rrule).toContain("INTERVAL=3");
  });

  it("parses 'every 2 weeks on monday'", () => {
    const result = parseRecurrenceLocal("every 2 weeks on monday");
    expect(result).not.toBeNull();
    expect(result?.rrule).toContain("FREQ=WEEKLY");
    expect(result?.rrule).toContain("INTERVAL=2");
    expect(result?.rrule).toContain("MO");
  });

  it("returns null for unparseable input", () => {
    expect(parseRecurrenceLocal("gibberish text")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseRecurrenceLocal("")).toBeNull();
  });

  it("strips RRULE: prefix from output", () => {
    const result = parseRecurrenceLocal("every day");
    expect(result?.rrule).not.toContain("RRULE:");
  });
});

describe("validateRRule", () => {
  it("returns true for valid RRULE string", () => {
    expect(validateRRule("FREQ=DAILY")).toBe(true);
  });

  it("returns true for RRULE with prefix", () => {
    expect(validateRRule("RRULE:FREQ=WEEKLY;BYDAY=MO")).toBe(true);
  });

  it("returns true for complex RRULE", () => {
    expect(validateRRule("FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15")).toBe(true);
  });

  it("returns false for invalid RRULE", () => {
    expect(validateRRule("not a rule")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(validateRRule("")).toBe(false);
  });
});

describe("parseRecurrenceLlm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls Anthropic API and returns parsed result", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: '{"rrule": "FREQ=WEEKLY;BYDAY=MO,WE,FR", "confidence": 0.95}',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await parseRecurrenceLlm("every monday wednesday friday", {
      provider: "anthropic",
      apiKey: "test-key",
    });

    expect(result).not.toBeNull();
    expect(result?.rrule).toBe("FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(result?.source).toBe("anthropic");
    expect(result?.humanText).toBeTruthy();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "test-key",
          "anthropic-version": "2023-06-01",
        }),
      }),
    );
  });

  it("calls OpenAI API and returns parsed result", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '{"rrule": "FREQ=MONTHLY;BYMONTHDAY=1", "confidence": 0.9}',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await parseRecurrenceLlm("first of every month", {
      provider: "openai",
      apiKey: "test-key",
    });

    expect(result).not.toBeNull();
    expect(result?.rrule).toBe("FREQ=MONTHLY;BYMONTHDAY=1");
    expect(result?.source).toBe("openai");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      }),
    );
  });

  it("uses default model when none specified", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: '{"rrule": "FREQ=DAILY", "confidence": 0.9}',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await parseRecurrenceLlm("every day", {
      provider: "anthropic",
      apiKey: "test-key",
    });

    const callBody = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(callBody.model).toBe("claude-haiku-4-5-20251001");
  });

  it("uses specified model when provided", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"rrule": "FREQ=DAILY", "confidence": 0.9}',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await parseRecurrenceLlm("every day", {
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-4o",
    });

    const callBody = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(callBody.model).toBe("gpt-4o");
  });

  it("returns null on API error", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }),
    );

    const result = await parseRecurrenceLlm("every day", {
      provider: "anthropic",
      apiKey: "bad-key",
    });

    expect(result).toBeNull();
  });

  it("returns null when response contains invalid RRULE", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: '{"rrule": "NOT_VALID_RRULE", "confidence": 0.5}',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await parseRecurrenceLlm("something weird", {
      provider: "anthropic",
      apiKey: "test-key",
    });

    expect(result).toBeNull();
  });

  it("returns null on network failure", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await parseRecurrenceLlm("every day", {
      provider: "anthropic",
      apiKey: "test-key",
    });

    expect(result).toBeNull();
  });

  it("includes reference date in prompt when provided", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: '{"rrule": "FREQ=DAILY", "confidence": 0.9}',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await parseRecurrenceLlm(
      "every day",
      { provider: "anthropic", apiKey: "test-key" },
      "2026-03-30",
    );

    const callBody = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(callBody.messages[0].content).toContain("2026-03-30");
  });
});

describe("parseRecurrence", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns local result when local parse succeeds", async () => {
    const result = await parseRecurrence("daily");
    expect(result).not.toBeNull();
    expect(result?.source).toBe("local");
    expect(result?.rrule).toContain("FREQ=DAILY");
  });

  it("does not call LLM when local parse succeeds", async () => {
    const mockFetch = vi.mocked(fetch);

    await parseRecurrence("daily", {
      provider: "anthropic",
      apiKey: "test-key",
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("falls back to LLM when local parse fails", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: '{"rrule": "FREQ=MONTHLY;BYMONTHDAY=15", "confidence": 0.85}',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await parseRecurrence("on the 15th of every month", {
      provider: "anthropic",
      apiKey: "test-key",
    });

    expect(result).not.toBeNull();
    expect(result?.source).toBe("anthropic");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("returns null when local fails and no LLM config", async () => {
    const result = await parseRecurrence("on the 15th of every month");
    expect(result).toBeNull();
  });
});
