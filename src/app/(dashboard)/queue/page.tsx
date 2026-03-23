import { cookies } from "next/headers";
import { QueueView } from "@/components/queue-view";
import { validateSession } from "@/core/auth";
import { getSettings } from "@/core/settings";
import { listTasks } from "@/core/task";
import { rankTasks } from "@/core/urgency";
import { db } from "@/db";

export default async function QueuePage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  const user = sessionId ? validateSession(db, sessionId) : null;
  const settings = user ? getSettings(db, user.id) : null;

  const tasks = listTasks(db);
  const ranked = rankTasks(db, tasks, settings?.urgencyWeights);
  return <QueueView tasks={ranked} />;
}
