import { like } from "drizzle-orm";
import { createTask } from "@/core/task";
import type { Db } from "@/core/types";
import { tasks } from "@/db/schema";

interface GitHubIssuesConfig {
  repos: string[];
  labels?: string[];
  category?: string;
  token: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  pull_request?: unknown;
  labels: Array<{ name: string }>;
  user?: { login: string };
}

interface GitHubUser {
  login: string;
}

function isValidConfig(config: unknown): config is GitHubIssuesConfig {
  if (typeof config !== "object" || config === null) return false;
  const c = config as Record<string, unknown>;
  return (
    Array.isArray(c.repos) &&
    c.repos.every((r: unknown) => typeof r === "string") &&
    typeof c.token === "string"
  );
}

function formatDescription(
  repo: string,
  title: string,
  number: number,
): string {
  return `[${repo}] ${title} (#${number})`;
}

async function fetchAuthenticatedUser(token: string): Promise<string> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  const user: GitHubUser = await response.json();
  return user.login;
}

async function fetchOpenIssues(
  repo: string,
  token: string,
): Promise<GitHubIssue[]> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=open`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub API error for ${repo}: ${response.status}`);
  }
  return response.json();
}

function issueMatchesLabels(issue: GitHubIssue, labels: string[]): boolean {
  const issueLabels = issue.labels.map((l) => l.name);
  return labels.some((label) => issueLabels.includes(label));
}

function taskExistsForIssue(
  db: Db,
  repo: string,
  issueNumber: number,
): boolean {
  const pattern = `[${repo}]%(#${issueNumber})`;
  const existing = db
    .select()
    .from(tasks)
    .where(like(tasks.description, pattern))
    .get();
  return existing !== undefined;
}

export async function githubIssuesHandler(
  db: Db,
  config: unknown,
): Promise<void> {
  if (!isValidConfig(config)) {
    throw new Error("Invalid github_issues config");
  }

  const username = await fetchAuthenticatedUser(config.token);
  const category = config.category ?? "Todo";

  for (const repo of config.repos) {
    const issues = await fetchOpenIssues(repo, config.token);

    for (const issue of issues) {
      if (issue.pull_request) continue;
      if (config.labels && config.labels.length > 0) {
        if (!issueMatchesLabels(issue, config.labels)) continue;
      }

      if (issue.user?.login === username) continue;

      if (taskExistsForIssue(db, repo, issue.number)) continue;

      createTask(db, {
        description: formatDescription(repo, issue.title, issue.number),
        category,
      });
    }
  }
}
