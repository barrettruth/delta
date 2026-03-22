import type { Task, TaskStatus } from "./types";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: "\x1b[34m",
  wip: "\x1b[33m",
  done: "\x1b[32m",
  blocked: "\x1b[31m",
  cancelled: "\x1b[90m",
};

function pad(s: string, len: number): string {
  return s.length >= len ? s : s + " ".repeat(len - s.length);
}

export function formatTask(task: Task): string {
  const color = STATUS_COLORS[task.status] ?? "";
  const id = `${DIM}#${task.id}${RESET}`;
  const status = `${color}${task.status}${RESET}`;
  const desc = `${BOLD}${task.description}${RESET}`;
  const parts = [id, status, desc];
  if (task.category) parts.push(`${DIM}[${task.category}]${RESET}`);
  if (task.due) parts.push(`${DIM}${task.due}${RESET}`);
  return parts.join(" ");
}

export function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) return `${DIM}No tasks${RESET}`;

  const idWidth = Math.max(...tasks.map((t) => `#${t.id}`.length));
  const statusWidth = Math.max(...tasks.map((t) => t.status.length));

  return tasks
    .map((task) => {
      const color = STATUS_COLORS[task.status] ?? "";
      const id = `${DIM}${pad(`#${task.id}`, idWidth)}${RESET}`;
      const status = `${color}${pad(task.status, statusWidth)}${RESET}`;
      const desc = `${BOLD}${task.description}${RESET}`;
      const parts = [id, status, desc];
      if (task.category) parts.push(`${DIM}[${task.category}]${RESET}`);
      if (task.due) parts.push(`${DIM}${task.due}${RESET}`);
      return parts.join("  ");
    })
    .join("\n");
}
