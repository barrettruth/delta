import { like } from "drizzle-orm";
import { createTask } from "@/core/task";
import type { Db } from "@/core/types";
import { tasks } from "@/db/schema";

interface GitHubDevConfig {
  token: string;
  category?: string;
}

interface GitHubRepo {
  full_name: string;
  archived: boolean;
  disabled: boolean;
}

interface GitHubItem {
  number: number;
  title: string;
  pull_request?: unknown;
  state: string;
}

function isValidConfig(config: unknown): config is GitHubDevConfig {
  if (typeof config !== "object" || config === null) return false;
  const c = config as Record<string, unknown>;
  return typeof c.token === "string";
}

function formatDescription(
  repo: string,
  title: string,
  number: number,
  isPR: boolean,
): string {
  const prefix = isPR ? "PR" : "issue";
  return `[${repo}] ${title} (${prefix} #${number})`;
}

function taskExists(db: Db, repo: string, number: number): boolean {
  const pattern = `[${repo}]%(#${number})`;
  return (
    db.select().from(tasks).where(like(tasks.description, pattern)).get() !==
    undefined
  );
}

async function ghFetch<T>(url: string, token: string): Promise<T> {
  const items: unknown[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const response: Response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${nextUrl}`);
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      items.push(...data);
    } else {
      return data as T;
    }

    const link: string | null = response.headers.get("link");
    nextUrl = null;
    if (link) {
      const match: RegExpMatchArray | null = link.match(
        /<([^>]+)>;\s*rel="next"/,
      );
      if (match) nextUrl = match[1];
    }
  }

  return items as T;
}

export async function githubDevHandler(
  db: Db,
  userId: number,
  config: unknown,
): Promise<void> {
  if (!isValidConfig(config)) {
    throw new Error("Invalid github_dev config");
  }

  const category = config.category ?? "dev";
  const repos = await ghFetch<GitHubRepo[]>(
    "https://api.github.com/user/repos?per_page=100&sort=pushed",
    config.token,
  );

  const activeRepos = repos.filter((r) => !r.archived && !r.disabled);

  for (const repo of activeRepos) {
    let items: GitHubItem[];
    try {
      items = await ghFetch<GitHubItem[]>(
        `https://api.github.com/repos/${repo.full_name}/issues?state=open&per_page=100`,
        config.token,
      );
    } catch {
      continue;
    }

    for (const item of items) {
      const isPR = !!item.pull_request;
      if (taskExists(db, repo.full_name, item.number)) continue;

      createTask(db, userId, {
        description: formatDescription(
          repo.full_name,
          item.title,
          item.number,
          isPR,
        ),
        category,
      });
    }
  }
}
