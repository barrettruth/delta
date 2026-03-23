import {
  completeTask,
  createTask,
  deleteTask,
  listTasks,
  me,
  updateTask,
} from "./api";
import { formatTask, formatTaskList } from "./format";
import type { CreateTaskInput, TaskFilters, UpdateTaskInput } from "./types";

function printHelp(): void {
  const text = `delta - task manager CLI

Usage:
  delta add "description" [--category Cat] [--priority N] [--due "${new Date().getFullYear()}-04-01"]
  delta list [--status pending,wip] [--category Work]
  delta done <id>
  delta delete <id>
  delta update <id> [--description "..."] [--status wip] [--priority N]
  delta me

Environment:
  DELTA_API_URL   API base URL (e.g. https://delta.barrettruth.com)
  DELTA_API_KEY   API key for authentication`;
  console.log(text);
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[i + 1];
      i += 2;
    } else {
      i++;
    }
  }
  return flags;
}

async function handleAdd(args: string[]): Promise<void> {
  const description = args.find((a) => !a.startsWith("--"));
  if (!description) {
    console.error("Error: description is required");
    process.exit(1);
  }
  const flags = parseFlags(args.slice(args.indexOf(description) + 1));
  const input: CreateTaskInput = { description };
  if (flags.category) input.category = flags.category;
  if (flags.priority) input.priority = Number(flags.priority);
  if (flags.due) input.due = flags.due;

  const task = await createTask(input);
  console.log(formatTask(task));
}

async function handleList(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const filters: TaskFilters = {};
  if (flags.status) filters.status = flags.status;
  if (flags.category) filters.category = flags.category;

  const tasks = await listTasks(filters);
  console.log(formatTaskList(tasks));
}

async function handleDone(args: string[]): Promise<void> {
  const id = Number(args[0]);
  if (!id) {
    console.error("Error: task id is required");
    process.exit(1);
  }
  const task = await completeTask(id);
  console.log(formatTask(task));
}

async function handleDelete(args: string[]): Promise<void> {
  const id = Number(args[0]);
  if (!id) {
    console.error("Error: task id is required");
    process.exit(1);
  }
  const task = await deleteTask(id);
  console.log(formatTask(task));
}

async function handleUpdate(args: string[]): Promise<void> {
  const id = Number(args[0]);
  if (!id) {
    console.error("Error: task id is required");
    process.exit(1);
  }
  const flags = parseFlags(args.slice(1));
  const input: UpdateTaskInput = {};
  if (flags.description) input.description = flags.description;
  if (flags.status) input.status = flags.status as UpdateTaskInput["status"];
  if (flags.priority) input.priority = Number(flags.priority);
  if (flags.due) input.due = flags.due;
  if (flags.category) input.category = flags.category;

  const task = await updateTask(id, input);
  console.log(formatTask(task));
}

async function handleMe(): Promise<void> {
  const result = await me();
  console.log(`${result.user.username} (id: ${result.user.id})`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case "add":
        await handleAdd(args.slice(1));
        break;
      case "list":
        await handleList(args.slice(1));
        break;
      case "done":
        await handleDone(args.slice(1));
        break;
      case "delete":
        await handleDelete(args.slice(1));
        break;
      case "update":
        await handleUpdate(args.slice(1));
        break;
      case "me":
        await handleMe();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}

main();
