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

const TASK_LIST_HELP = `
Defaults:
  Without a status filter, only pending tasks are shown.

Filters:
  status:pending|wip|done|blocked|cancelled
  category:<name>
  due.before:<date>
  due.after:<date>
  sort:due|createdAt|order

Examples:
  delta task list status:wip --json
  delta task list status:blocked --json
  delta task list category:work sort:due
`;

export async function listTasks(
  filterArgs: string[] | undefined = [],
  opts: Record<string, string> = {},
): Promise<void> {
  const client = createClient();
  const filters = parseFilters(filterArgs);
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

  if (opts.from) params.due_after = parseDate(opts.from);
  if (opts.until) params.due_before = parseDate(opts.until);

  const tasks = await client.get<TaskResponse[]>("/api/tasks", params);
  print(tasks, {
    columns: ["id", "description", "category", "status", "due"],
  });
}

export function registerTaskCommands(task: Command): void {
  task.argument("[filters...]", "Task list filters");

  task
    .command("list")
    .description("List tasks with filters (defaults to pending)")
    .argument("[filters...]", "Filter expressions")
    .option("--from <date>", "Due date lower bound")
    .option("--until <date>", "Due date upper bound")
    .allowUnknownOption(false)
    .addHelpText("after", TASK_LIST_HELP)
    .action(
      async (
        filterArgs: string[] | undefined,
        opts: Record<string, string>,
      ) => {
        await listTasks(filterArgs, opts);
      },
    );

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

  const dep = task.command("dep").description("Manage task dependencies");

  dep
    .command("add")
    .description("Add dependency")
    .argument("<id>", "Task ID")
    .argument("<depends-on-id>", "Depends-on task ID")
    .action(async (id: string, dependsOnId: string) => {
      const client = createClient();
      await client.post(`/api/tasks/${id}/deps`, {
        depends_on_id: Number(dependsOnId),
      });
      process.stdout.write(`#${id} now depends on #${dependsOnId}\n`);
    });

  dep
    .command("rm")
    .description("Remove dependency")
    .argument("<id>", "Task ID")
    .argument("<depends-on-id>", "Depends-on task ID")
    .action(async (id: string, dependsOnId: string) => {
      const client = createClient();
      await client.delete(`/api/tasks/${id}/deps/${dependsOnId}`);
      process.stdout.write(`removed dependency #${dependsOnId} from #${id}\n`);
    });

  dep
    .command("list")
    .description("List dependencies for task")
    .argument("<id>", "Task ID")
    .action(async (id: string) => {
      const client = createClient();
      const deps = await client.get<TaskResponse[]>(`/api/tasks/${id}/deps`);
      print(deps, {
        columns: ["id", "description", "status"],
      });
    });

  task.action(async (filterArgs: string[] | undefined) => {
    await listTasks(filterArgs);
  });
}
