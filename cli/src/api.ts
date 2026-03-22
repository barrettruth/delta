import type {
  CreateTaskInput,
  Task,
  TaskFilters,
  UpdateTaskInput,
  User,
} from "./types";

function getConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.DELTA_API_URL;
  const apiKey = process.env.DELTA_API_KEY;
  if (!baseUrl) {
    throw new Error("DELTA_API_URL is not set");
  }
  if (!apiKey) {
    throw new Error("DELTA_API_KEY is not set");
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const { baseUrl, apiKey } = getConfig();
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    "x-api-key": apiKey,
  };
  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {}
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export function listTasks(filters?: TaskFilters): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.category) params.set("category", filters.category);
  const qs = params.toString();
  return request<Task[]>("GET", `/api/tasks${qs ? `?${qs}` : ""}`);
}

export function createTask(input: CreateTaskInput): Promise<Task> {
  return request<Task>("POST", "/api/tasks", input);
}

export function getTask(id: number): Promise<Task> {
  return request<Task>("GET", `/api/tasks/${id}`);
}

export function updateTask(id: number, input: UpdateTaskInput): Promise<Task> {
  return request<Task>("PATCH", `/api/tasks/${id}`, input);
}

export function completeTask(id: number): Promise<Task> {
  return request<Task>("PATCH", `/api/tasks/${id}`, { status: "done" });
}

export function deleteTask(id: number): Promise<Task> {
  return request<Task>("DELETE", `/api/tasks/${id}`);
}

export function me(): Promise<{ user: User }> {
  return request<{ user: User }>("GET", "/api/auth/me");
}
