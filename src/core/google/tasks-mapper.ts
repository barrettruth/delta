import type {
  GoogleTask,
  GoogleTaskList,
  GoogleTasksMappedTask,
} from "./types";

function notesDoc(text: string): string {
  return JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  });
}

function normalizeDue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function completedAt(task: GoogleTask, syncTime: string): string | null {
  if (task.status !== "completed" && !task.deleted) return null;
  return task.completed ?? task.updated ?? syncTime;
}

export function googleTaskExternalId(
  taskListId: string,
  taskId: string,
): string {
  return `${taskListId}:${taskId}`;
}

export function mapGoogleTask(
  list: GoogleTaskList,
  task: GoogleTask,
  syncTime: string,
): GoogleTasksMappedTask {
  const deleted = task.deleted === true;
  const status = deleted
    ? "cancelled"
    : task.status === "completed"
      ? "done"
      : "pending";
  const title = task.title?.trim() || "(untitled Google task)";
  const metadata = {
    listId: list.id,
    listTitle: list.title,
    listUpdated: list.updated ?? null,
    taskId: task.id,
    etag: task.etag ?? null,
    updated: task.updated ?? null,
    completed: task.completed ?? null,
    deleted,
    hidden: task.hidden === true,
    parent: task.parent ?? null,
    position: task.position ?? null,
    selfLink: task.selfLink ?? null,
    webViewLink: task.webViewLink ?? null,
    links: task.links ?? [],
    assignmentInfo: task.assignmentInfo ?? null,
  };

  return {
    externalId: googleTaskExternalId(list.id, task.id),
    input: {
      description: title,
      status,
      category: list.title || "Todo",
      ...(task.notes ? { notes: notesDoc(task.notes) } : { notes: null }),
      due: normalizeDue(task.due) ?? null,
      completedAt: completedAt(task, syncTime),
    },
    metadata,
  };
}
