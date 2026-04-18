import { describe, expect, it } from "vitest";
import {
  type CommandContext,
  commandRegistry,
  executeCommand,
  getCompletions,
  longestCommonPrefix,
  parseCommand,
  resolveCommand,
} from "@/core/commands";

describe("parseCommand", () => {
  it("parses a simple command", () => {
    const result = parseCommand("quit");
    expect(result).toEqual({ name: "quit", args: [], bang: false });
  });

  it("parses a command with bang", () => {
    const result = parseCommand("quit!");
    expect(result).toEqual({ name: "quit", args: [], bang: true });
  });

  it("parses a command with arguments", () => {
    const result = parseCommand("calendar week");
    expect(result).toEqual({ name: "calendar", args: ["week"], bang: false });
  });

  it("trims whitespace", () => {
    const result = parseCommand("  quit  ");
    expect(result).toEqual({ name: "quit", args: [], bang: false });
  });

  it("handles multiple arguments", () => {
    const result = parseCommand("sort due asc");
    expect(result).toEqual({ name: "sort", args: ["due", "asc"], bang: false });
  });

  it("returns empty name for empty input", () => {
    const result = parseCommand("");
    expect(result).toEqual({ name: "", args: [], bang: false });
  });

  it("handles extra whitespace between args", () => {
    const result = parseCommand("cal   week");
    expect(result).toEqual({ name: "cal", args: ["week"], bang: false });
  });
});

describe("resolveCommand", () => {
  it("matches exact command name", () => {
    const result = resolveCommand("quit", commandRegistry);
    expect(typeof result).not.toBe("string");
    if (typeof result !== "string") {
      expect(result.name).toBe("quit");
    }
  });

  it("matches alias", () => {
    const result = resolveCommand("q", commandRegistry);
    expect(typeof result).not.toBe("string");
    if (typeof result !== "string") {
      expect(result.name).toBe("quit");
    }
  });

  it("matches unique prefix", () => {
    const result = resolveCommand("he", commandRegistry);
    expect(typeof result).not.toBe("string");
    if (typeof result !== "string") {
      expect(result.name).toBe("help");
    }
  });

  it("returns ambiguous for non-unique prefix", () => {
    const result = resolveCommand("qu", commandRegistry);
    expect(typeof result).toBe("string");
    expect(result).toContain("ambiguous command");
  });

  it("returns error for ambiguous prefix", () => {
    const result = resolveCommand("s", commandRegistry);
    expect(typeof result).toBe("string");
    expect(result).toContain("ambiguous command");
  });

  it("returns error for unknown command", () => {
    const result = resolveCommand("foobar", commandRegistry);
    expect(typeof result).toBe("string");
    expect(result).toBe("unknown command: foobar");
  });

  it("matches calendar alias", () => {
    const result = resolveCommand("cal", commandRegistry);
    expect(typeof result).not.toBe("string");
    if (typeof result !== "string") {
      expect(result.name).toBe("calendar");
    }
  });

  it("matches kanban alias", () => {
    const result = resolveCommand("kan", commandRegistry);
    expect(typeof result).not.toBe("string");
    if (typeof result !== "string") {
      expect(result.name).toBe("kanban");
    }
  });
});

describe("executeCommand", () => {
  function makeMockContext(
    overrides: Partial<CommandContext> = {},
  ): CommandContext {
    return {
      router: { push: () => {}, refresh: () => {} },
      logout: () => {},
      toggleSidebar: () => {},
      openHelp: () => {},
      undo: () => {},
      taskPanel: {
        isOpen: false,
        mode: "edit",
        taskId: null,
        open: () => {},
        create: () => {},
        close: () => {},
      },
      saveTask: () => {},
      discardTask: () => {},
      importIcal: () => {},
      exportIcal: () => {},
      statusBar: { message: () => {}, error: () => {} },
      ...overrides,
    };
  }

  it("returns null on successful execution", () => {
    const ctx = makeMockContext();
    const result = executeCommand("help", commandRegistry, ctx);
    expect(result).toBeNull();
  });

  it("returns error for unknown command", () => {
    const ctx = makeMockContext();
    const result = executeCommand("foobar", commandRegistry, ctx);
    expect(result).toBe("unknown command: foobar");
  });

  it("calls logout on :quit", () => {
    let called = false;
    const ctx = makeMockContext({
      logout: () => {
        called = true;
      },
    });
    executeCommand("quit", commandRegistry, ctx);
    expect(called).toBe(true);
  });

  it("calls logout with force on :quit!", () => {
    let forceCalled = false;
    const ctx = makeMockContext({
      logout: (force) => {
        forceCalled = !!force;
      },
    });
    executeCommand("quit!", commandRegistry, ctx);
    expect(forceCalled).toBe(true);
  });

  it("navigates to calendar with mode argument", () => {
    let pushed = "";
    const ctx = makeMockContext({
      router: {
        push: (url) => {
          pushed = url;
        },
        refresh: () => {},
      },
    });
    executeCommand("cal week", commandRegistry, ctx);
    expect(pushed).toBe("/calendar?mode=week");
  });

  it("navigates to calendar without argument", () => {
    let pushed = "";
    const ctx = makeMockContext({
      router: {
        push: (url) => {
          pushed = url;
        },
        refresh: () => {},
      },
    });
    executeCommand("calendar", commandRegistry, ctx);
    expect(pushed).toBe("/calendar");
  });

  it("returns error for invalid calendar argument", () => {
    const ctx = makeMockContext();
    const result = executeCommand("calendar foo", commandRegistry, ctx);
    expect(result).toBe(
      "calendar: unexpected argument 'foo' (expected: day, week, month, import, export)",
    );
  });

  it("returns error for unexpected argument on no-arg command", () => {
    const ctx = makeMockContext();
    const result = executeCommand("quit foo", commandRegistry, ctx);
    expect(result).toBe("quit: unexpected argument 'foo'");
  });

  it("handles :wq command", () => {
    let saved = false;
    let closed = false;
    const ctx = makeMockContext({
      saveTask: () => {
        saved = true;
      },
      taskPanel: {
        isOpen: true,
        mode: "edit",
        taskId: 1,
        open: () => {},
        create: () => {},
        close: () => {
          closed = true;
        },
      },
    });
    executeCommand("wq", commandRegistry, ctx);
    expect(saved).toBe(true);
    expect(closed).toBe(true);
  });

  it("handles :x alias for :wq", () => {
    let saved = false;
    let closed = false;
    const ctx = makeMockContext({
      saveTask: () => {
        saved = true;
      },
      taskPanel: {
        isOpen: true,
        mode: "edit",
        taskId: 1,
        open: () => {},
        create: () => {},
        close: () => {
          closed = true;
        },
      },
    });
    executeCommand("x", commandRegistry, ctx);
    expect(saved).toBe(true);
    expect(closed).toBe(true);
  });

  it("returns null for empty input", () => {
    const ctx = makeMockContext();
    const result = executeCommand("", commandRegistry, ctx);
    expect(result).toBeNull();
  });

  it("calls toggleSidebar on :sidebar", () => {
    let toggled = false;
    const ctx = makeMockContext({
      toggleSidebar: () => {
        toggled = true;
      },
    });
    executeCommand("sidebar", commandRegistry, ctx);
    expect(toggled).toBe(true);
  });

  it("calls undo on :undo", () => {
    let undone = false;
    const ctx = makeMockContext({
      undo: () => {
        undone = true;
      },
    });
    executeCommand("undo", commandRegistry, ctx);
    expect(undone).toBe(true);
  });

  it("navigates to queue on :queue", () => {
    let pushed = "";
    const ctx = makeMockContext({
      router: {
        push: (url) => {
          pushed = url;
        },
        refresh: () => {},
      },
    });
    executeCommand("queue", commandRegistry, ctx);
    expect(pushed).toBe("/?view=queue");
  });

  it("navigates to kanban on :kanban", () => {
    let pushed = "";
    const ctx = makeMockContext({
      router: {
        push: (url) => {
          pushed = url;
        },
        refresh: () => {},
      },
    });
    executeCommand("kanban", commandRegistry, ctx);
    expect(pushed).toBe("/kanban");
  });

  it("navigates to settings on :settings", () => {
    let pushed = "";
    const ctx = makeMockContext({
      router: {
        push: (url) => {
          pushed = url;
        },
        refresh: () => {},
      },
    });
    executeCommand("settings", commandRegistry, ctx);
    expect(pushed).toBe("/settings");
  });

  it("handles :set alias for settings", () => {
    let pushed = "";
    const ctx = makeMockContext({
      router: {
        push: (url) => {
          pushed = url;
        },
        refresh: () => {},
      },
    });
    executeCommand("set", commandRegistry, ctx);
    expect(pushed).toBe("/settings");
  });
});

describe("getCompletions", () => {
  it("returns matching commands for prefix", () => {
    const results = getCompletions("q", commandRegistry);
    expect(results).toContain("quit");
    expect(results).toContain("queue");
  });

  it("returns empty for no match", () => {
    const results = getCompletions("xyz", commandRegistry);
    expect(results).toEqual([]);
  });

  it("returns single match", () => {
    const results = getCompletions("he", commandRegistry);
    expect(results).toEqual(["help"]);
  });

  it("returns empty for empty input", () => {
    const results = getCompletions("", commandRegistry);
    expect(results).toEqual([]);
  });

  it("includes alias matches", () => {
    const results = getCompletions("ka", commandRegistry);
    expect(results).toContain("kanban");
    expect(results).toContain("kan");
  });
});

describe("longestCommonPrefix", () => {
  it("returns common prefix of multiple strings", () => {
    expect(longestCommonPrefix(["quit", "queue"])).toBe("qu");
  });

  it("returns the string itself for single element", () => {
    expect(longestCommonPrefix(["help"])).toBe("help");
  });

  it("returns empty for no common prefix", () => {
    expect(longestCommonPrefix(["abc", "xyz"])).toBe("");
  });

  it("returns empty for empty array", () => {
    expect(longestCommonPrefix([])).toBe("");
  });

  it("handles identical strings", () => {
    expect(longestCommonPrefix(["test", "test"])).toBe("test");
  });
});
