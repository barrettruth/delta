import { QueueView } from "@/components/queue-view";
import { listTasks } from "@/core/task";
import { rankTasks } from "@/core/urgency";
import { db } from "@/db";

export default function QueuePage() {
  const tasks = listTasks(db);
  const ranked = rankTasks(db, tasks);
  return <QueueView tasks={ranked} />;
}
