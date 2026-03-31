import type { Command } from "commander";
import { createClient } from "./lib/client.js";
import { parseDate } from "./lib/dates.js";
import { parseFilters } from "./lib/filters.js";
import { print } from "./lib/output.js";

interface TaskResponse {
  id: number;
  description: string;
  status: string;
  category: string | null;
  due: string | null;
  startAt: string | null;
  endAt: string | null;
  allDay: number | null;
  recurrence: string | null;
  recurMode: string | null;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
}

interface CompleteResponse {
  task: TaskResponse;
  spawnedTaskId: number | null;
}

function buildTaskBody(opts: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (opts.due !== undefined) body.due = parseDate(opts.due as string);
  if (opts.category !== undefined) body.category = opts.category;
  if (opts.priority !== undefined) body.priority = Number(opts.priority);
  if (opts.start !== undefined) body.startAt = parseDate(opts.start as string);
  if (opts.end !== undefined) body.endAt = parseDate(opts.end as string);
  if (opts.allDay) body.allDay = 1;
  if (opts.recurrence !== undefined) body.recurrence = opts.recurrence;
  if (opts.recurMode !== undefined) body.recurMode = opts.recurMode;
  if (opts.location !== undefined) body.location = opts.location;
  if (opts.meeting !== undefined) body.meetingUrl = opts.meeting;
  if (opts.notes !== undefined) body.notes = opts.notes;
  if (opts.status !== undefined) body.status = opts.status;

  return body;
}

function addTaskFlags(cmd: Command): Command {
  return cmd
    .option("-d, --due <date>", "Due date")
    .option("-c, --category <name>", "Category name")
    .option("-p, --priority <n>", "Priority")
    .option("--start <datetime>", "Start time")
    .option("--end <datetime>", "End time")
    .option("--all-day", "All-day event")
    .option("--recurrence <text>", "Recurrence rule")
    .option("--recur-mode <mode>", "Recurrence mode (scheduled | completion)")
    .option("--location <text>", "Location string")
    .option("--meeting <url>", "Meeting URL")
    .option("--notes <text>", "Plain text notes")
    .option("--status <status>", "Task status");
}

export function registerTaskCommands(task: Command): void {
  task
    .command("list")
    .description("List tasks with filters")
    .option("--from <date>", "Start date filter (on startAt)")
    .option("--until <date>", "End date filter (on startAt)")
    .allowUnknownOption(false)
    .action(async (opts: Record<string, string>, cmd: Command) => {
      const client = createClient();
      const remaining = cmd.args;
      const filters = parseFilters(remaining);
      const params: Record<string, string> = {};

      if (!filters.status) {
        params.status = "pending";
      } else {
        params.status = filters.status.value;
      }

      if (filters.category) params.category = filters.category.value;
      if (filters["due.before"])
        params.due_before = parseDate(filters["due.before"].value);
      if (filters["due.after"])
        params.due_after = parseDate(filters["due.after"].value);
      if (filters.sort) params.sort_by = filters.sort.value;
      if (filters.limit) params.limit = filters.limit.value;

      if (opts.from) params.due_after = parseDate(opts.from);
      if (opts.until) params.due_before = parseDate(opts.until);

      const tasks = await client.get<TaskResponse[]>("/api/tasks", params);
      print(tasks, {
        columns: ["id", "description", "category", "status", "due"],
      });
    });

  addTaskFlags(
    task
      .command("add")
      .description("Create a task")
      .argument("<description>", "Task description"),
  ).action(async (description: string, opts: Record<string, unknown>) => {
    const client = createClient();
    const body = buildTaskBody(opts);
    body.description = description;

    const created = await client.post<TaskResponse>("/api/tasks", body);
    process.stdout.write(`created #${created.id} ${created.description}\n`);
  });

  addTaskFlags(
    task
      .command("edit")
      .description("Update a task")
      .argument("<id>", "Task ID")
      .option("--scope <scope>", "Recurrence edit scope (this | future | all)"),
  ).action(async (id: string, opts: Record<string, unknown>) => {
    const client = createClient();
    const { scope, ...rest } = opts;
    const body = buildTaskBody(rest);
    const path = scope ? `/api/tasks/${id}?scope=${scope}` : `/api/tasks/${id}`;

    await client.patch<TaskResponse>(path, body);
    process.stdout.write(`updated #${id}\n`);
  });

  task
    .command("done")
    .description("Complete task(s)")
    .argument("<ids...>", "Task ID(s)")
    .action(async (ids: string[]) => {
      const client = createClient();
      for (const id of ids) {
        const result = await client.post<CompleteResponse>(
          `/api/tasks/${id}/complete`,
        );
        process.stdout.write(`done #${id} ${result.task.description}\n`);
      }
    });

  task
    .command("delete")
    .description("Soft-delete task(s)")
    .argument("<ids...>", "Task ID(s)")
    .action(async (ids: string[]) => {
      const client = createClient();
      for (const id of ids) {
        await client.delete(`/api/tasks/${id}`);
        process.stdout.write(`deleted #${id}\n`);
      }
    });

  for (const [verb, status, label] of [
    ["wip", "wip", "wip"],
    ["block", "blocked", "blocked"],
    ["pending", "pending", "pending"],
  ] as const) {
    task
      .command(verb)
      .description(`Set task(s) to ${status}`)
      .argument("<ids...>", "Task ID(s)")
      .action(async (ids: string[]) => {
        const client = createClient();
        for (const id of ids) {
          await client.patch(`/api/tasks/${id}`, { status });
          process.stdout.write(`${label} #${id}\n`);
        }
      });
  }

  task.action(() => {
    task.commands.find((c) => c.name() === "list")?.parse(process.argv);
  });
}
