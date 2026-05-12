import type { GoogleTask, GoogleTaskList } from "./types";

const TASKS_BASE_URL = "https://tasks.googleapis.com/tasks/v1";

interface GoogleTaskListsResponse {
  items?: GoogleTaskList[];
  nextPageToken?: string;
}

interface GoogleTasksResponse {
  items?: GoogleTask[];
  nextPageToken?: string;
}

export class GoogleTasksApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "GoogleTasksApiError";
  }
}

async function googleGet<T>(
  accessToken: string,
  path: string,
  params?: URLSearchParams,
): Promise<T> {
  const suffix = params?.toString();
  const response = await fetch(
    `${TASKS_BASE_URL}${path}${suffix ? `?${suffix}` : ""}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new GoogleTasksApiError(
      `Google Tasks API request failed (${response.status})`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

export async function listGoogleTaskLists(
  accessToken: string,
): Promise<GoogleTaskList[]> {
  const lists: GoogleTaskList[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ maxResults: "1000" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await googleGet<GoogleTaskListsResponse>(
      accessToken,
      "/users/@me/lists",
      params,
    );
    lists.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return lists;
}

export async function listGoogleTasks(
  accessToken: string,
  taskListId: string,
  options: { updatedMin?: string } = {},
): Promise<GoogleTask[]> {
  const tasks: GoogleTask[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      maxResults: "100",
      showCompleted: "true",
      showDeleted: "true",
      showHidden: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    if (options.updatedMin) params.set("updatedMin", options.updatedMin);

    const data = await googleGet<GoogleTasksResponse>(
      accessToken,
      `/lists/${encodeURIComponent(taskListId)}/tasks`,
      params,
    );
    tasks.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return tasks;
}
