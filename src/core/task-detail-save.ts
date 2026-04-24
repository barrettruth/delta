import type { TaskPanelReminderDraft } from "@/lib/task-panel-reminders";
import { taskPanelRemindersEqual } from "@/lib/task-panel-reminders";
import { getReminderEndpoint } from "./reminders/endpoints";
import {
  createTaskReminder,
  deleteTaskReminder,
  listTaskReminders,
  updateTaskReminder,
} from "./reminders/rules";
import type { TaskReminder } from "./reminders/types";
import { getTask, updateTask } from "./task";
import type { Db, Task, UpdateTaskInput } from "./types";

interface SaveTaskDetailsInput {
  task: UpdateTaskInput;
  reminders?: TaskPanelReminderDraft[] | null;
}

interface SaveTaskDetailsResult {
  task: Task;
  reminders: TaskReminder[];
}

function syncTaskReminders(
  db: Db,
  userId: number,
  taskId: number,
  reminders: TaskPanelReminderDraft[],
): TaskReminder[] {
  const existing = listTaskReminders(db, userId, taskId);
  const existingById = new Map(
    existing.map((reminder) => [reminder.id, reminder]),
  );
  const nextIds = new Set<number>();

  for (const reminder of reminders) {
    if (reminder.id !== null) {
      if (nextIds.has(reminder.id)) {
        throw new Error(`Task reminder ${reminder.id} is duplicated`);
      }
      nextIds.add(reminder.id);
    }

    if (reminder.endpointId === null) {
      throw new Error("Reminder endpoint is required");
    }

    const endpoint = getReminderEndpoint(db, userId, reminder.endpointId);
    if (!endpoint) {
      throw new Error("Reminder endpoint not found");
    }
  }

  for (const reminder of existing) {
    if (!nextIds.has(reminder.id)) {
      deleteTaskReminder(db, userId, reminder.id);
    }
  }

  return reminders.map((reminder) => {
    if (reminder.endpointId === null) {
      throw new Error("Reminder endpoint is required");
    }

    if (reminder.id === null) {
      return createTaskReminder(db, userId, {
        taskId,
        endpointId: reminder.endpointId,
        anchor: reminder.anchor,
        offsetMinutes: reminder.offsetMinutes,
        allDayLocalTime: reminder.allDayLocalTime,
        enabled: reminder.enabled,
      });
    }

    const existingReminder = existingById.get(reminder.id);
    if (!existingReminder) {
      throw new Error(`Task reminder ${reminder.id} not found`);
    }

    if (
      taskPanelRemindersEqual(
        {
          id: existingReminder.id,
          endpointId: existingReminder.endpointId,
          anchor: existingReminder.anchor,
          offsetMinutes: existingReminder.offsetMinutes,
          allDayLocalTime: existingReminder.allDayLocalTime,
          enabled: existingReminder.enabled === 1 ? 1 : 0,
        },
        reminder,
      )
    ) {
      return existingReminder;
    }

    const updated = updateTaskReminder(db, userId, reminder.id, {
      endpointId: reminder.endpointId,
      anchor: reminder.anchor,
      offsetMinutes: reminder.offsetMinutes,
      allDayLocalTime: reminder.allDayLocalTime,
      enabled: reminder.enabled,
    });

    if (!updated) {
      throw new Error(`Task reminder ${reminder.id} not found`);
    }

    return updated;
  });
}

export function saveTaskDetails(
  db: Db,
  userId: number,
  taskId: number,
  input: SaveTaskDetailsInput,
): SaveTaskDetailsResult {
  const existingTask = getTask(db, taskId);
  if (!existingTask || existingTask.userId !== userId) {
    throw new Error("Task not found");
  }

  return db.transaction((tx) => {
    const txDb = tx as Db;
    const task = updateTask(txDb, taskId, input.task);
    const reminders =
      input.reminders === undefined || input.reminders === null
        ? listTaskReminders(txDb, userId, taskId)
        : syncTaskReminders(txDb, userId, taskId, input.reminders);

    return { task, reminders };
  });
}
