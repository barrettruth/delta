import { getTask, updateTask } from "./task";
import type { Db, Task, UpdateTaskInput } from "./types";

interface SaveTaskDetailsInput {
  task: UpdateTaskInput;
}

interface SaveTaskDetailsResult {
  task: Task;
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
    return { task };
  });
}
