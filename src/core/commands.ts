export interface ParsedCommand {
  name: string;
  args: string[];
  bang: boolean;
}

export interface CommandDefinition {
  name: string;
  aliases: string[];
  description: string;
  category: "navigation" | "task" | "calendar" | "general";
  expectedArgs: string[] | null;
  execute: (args: string[], ctx: CommandContext) => void;
}

export interface CommandContext {
  router: { push: (url: string) => void; refresh: () => void };
  logout: (force?: boolean) => void;
  toggleSidebar: () => void;
  openHelp: () => void;
  undo: () => void;
  taskPanel: {
    isOpen: boolean;
    mode: string;
    taskId: number | null;
    open: (id: number) => void;
    create: () => void;
    close: () => void;
  };
  saveTask: () => void;
  discardTask: () => void;
  importIcal: () => void;
  exportIcal: () => void;
  syncGoogle: () => void;
  statusBar: {
    message: (text: string) => void;
    error: (text: string) => void;
  };
}

export function parseCommand(raw: string): ParsedCommand {
  const trimmed = raw.trim();
  const parts = trimmed.split(/\s+/);
  let name = parts[0] || "";
  const args = parts.slice(1);
  let bang = false;

  if (name.endsWith("!")) {
    bang = true;
    name = name.slice(0, -1);
  }

  return { name, args, bang };
}

export function resolveCommand(
  name: string,
  registry: CommandDefinition[],
): CommandDefinition | string {
  for (const cmd of registry) {
    if (cmd.name === name) return cmd;
    if (cmd.aliases.includes(name)) return cmd;
  }

  const prefixMatches = registry.filter(
    (cmd) =>
      cmd.name.startsWith(name) || cmd.aliases.some((a) => a.startsWith(name)),
  );

  if (prefixMatches.length === 1) return prefixMatches[0];
  if (prefixMatches.length > 1) {
    const names = prefixMatches.map((c) => c.name).join(", ");
    return `ambiguous command: ${name} (could be: ${names})`;
  }

  return `unknown command: ${name}`;
}

function validateArgs(cmd: CommandDefinition, args: string[]): string | null {
  if (cmd.expectedArgs === null) return null;
  if (cmd.expectedArgs.length === 0 && args.length > 0) {
    return `${cmd.name}: unexpected argument '${args[0]}'`;
  }
  if (cmd.expectedArgs.length > 0 && args.length > 0) {
    if (!cmd.expectedArgs.includes(args[0])) {
      return `${cmd.name}: unexpected argument '${args[0]}' (expected: ${cmd.expectedArgs.join(", ")})`;
    }
  }
  return null;
}

export function executeCommand(
  raw: string,
  registry: CommandDefinition[],
  ctx: CommandContext,
): string | null {
  const parsed = parseCommand(raw);
  if (!parsed.name) return null;

  if (parsed.name === "wq" || (parsed.name === "w" && parsed.args[0] === "q")) {
    const wqCmd = registry.find((c) => c.name === "wq");
    if (wqCmd) {
      wqCmd.execute([], ctx);
      return null;
    }
  }

  const result = resolveCommand(parsed.name, registry);
  if (typeof result === "string") return result;

  if (parsed.bang && result.name === "quit") {
    ctx.logout(true);
    return null;
  }

  const argErr = validateArgs(result, parsed.args);
  if (argErr) return argErr;

  result.execute(parsed.args, ctx);
  return null;
}

export const commandRegistry: CommandDefinition[] = [
  {
    name: "quit",
    aliases: ["q"],
    description: "Close panel or logout",
    category: "general",
    expectedArgs: [],
    execute: (_args, ctx) => {
      if (ctx.taskPanel.isOpen) {
        ctx.discardTask();
        ctx.taskPanel.close();
      } else {
        ctx.logout();
      }
    },
  },
  {
    name: "write",
    aliases: ["w"],
    description: "Save current task",
    category: "task",
    expectedArgs: [],
    execute: (_args, ctx) => ctx.saveTask(),
  },
  {
    name: "wq",
    aliases: ["x"],
    description: "Save and close task panel",
    category: "task",
    expectedArgs: [],
    execute: (_args, ctx) => {
      ctx.saveTask();
      ctx.taskPanel.close();
    },
  },
  {
    name: "edit",
    aliases: ["e"],
    description: "Open task for editing",
    category: "task",
    expectedArgs: [],
    execute: (_args, ctx) => {
      if (ctx.taskPanel.taskId) {
        ctx.taskPanel.open(ctx.taskPanel.taskId);
      }
    },
  },
  {
    name: "new",
    aliases: [],
    description: "Create new task",
    category: "task",
    expectedArgs: [],
    execute: (_args, ctx) => ctx.taskPanel.create(),
  },
  {
    name: "queue",
    aliases: [],
    description: "Navigate to queue",
    category: "navigation",
    expectedArgs: [],
    execute: (_args, ctx) => ctx.router.push("/"),
  },
  {
    name: "kanban",
    aliases: ["kan"],
    description: "Navigate to kanban",
    category: "navigation",
    expectedArgs: [],
    execute: (_args, ctx) => ctx.router.push("/kanban"),
  },
  {
    name: "calendar",
    aliases: ["cal"],
    description: "Navigate to calendar or manage events",
    category: "navigation",
    expectedArgs: ["week", "month", "import", "export", "sync"],
    execute: (args, ctx) => {
      if (args[0] === "import") return ctx.importIcal();
      if (args[0] === "export") return ctx.exportIcal();
      if (args[0] === "sync") return ctx.syncGoogle();
      if (args[0]) {
        ctx.router.push(`/calendar?mode=${args[0]}`);
      } else {
        ctx.router.push("/calendar");
      }
    },
  },
  {
    name: "settings",
    aliases: ["set"],
    description: "Navigate to settings",
    category: "navigation",
    expectedArgs: [],
    execute: (_args, ctx) => ctx.router.push("/settings"),
  },
  {
    name: "help",
    aliases: ["h"],
    description: "Open keymap help",
    category: "general",
    expectedArgs: [],
    execute: (_args, ctx) => ctx.openHelp(),
  },
  {
    name: "undo",
    aliases: ["u"],
    description: "Undo last operation",
    category: "general",
    expectedArgs: [],
    execute: (_args, ctx) => ctx.undo(),
  },
  {
    name: "sidebar",
    aliases: [],
    description: "Toggle sidebar",
    category: "general",
    expectedArgs: [],
    execute: (_args, ctx) => ctx.toggleSidebar(),
  },
];

export function getCompletions(
  input: string,
  registry: CommandDefinition[],
): string[] {
  if (!input) return [];

  const parts = input.split(/\s+/);
  if (parts.length >= 2) {
    const cmdName = parts[0];
    const argPrefix = parts[1];
    const resolved = resolveCommand(cmdName, registry);
    if (typeof resolved !== "string" && resolved.expectedArgs) {
      return resolved.expectedArgs
        .filter((a) => a.startsWith(argPrefix))
        .map((a) => `${resolved.name} ${a}`)
        .sort();
    }
    return [];
  }

  const candidates: string[] = [];
  for (const cmd of registry) {
    if (cmd.name.startsWith(input)) candidates.push(cmd.name);
    for (const alias of cmd.aliases) {
      if (alias.startsWith(input)) candidates.push(alias);
    }
  }
  return candidates.sort();
}

export function longestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return "";
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (!prefix) return "";
    }
  }
  return prefix;
}
