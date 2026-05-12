import { describe, expect, it, vi } from "vitest";
import {
  listGoogleTaskLists,
  listGoogleTasks,
} from "@/core/google/tasks-client";

function googleResponse(body: Record<string, unknown>) {
  return Response.json(body);
}

describe("Google Tasks client", () => {
  it("paginates task lists with a bearer token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        googleResponse({
          items: [{ id: "list-1", title: "Work" }],
          nextPageToken: "next-lists",
        }),
      )
      .mockResolvedValueOnce(
        googleResponse({ items: [{ id: "list-2", title: "Home" }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listGoogleTaskLists("access-token")).resolves.toEqual([
      { id: "list-1", title: "Work" },
      { id: "list-2", title: "Home" },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string);
    const secondUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(firstUrl.pathname).toBe("/tasks/v1/users/@me/lists");
    expect(firstUrl.searchParams.get("maxResults")).toBe("1000");
    expect(secondUrl.searchParams.get("pageToken")).toBe("next-lists");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: "Bearer access-token" },
    });
  });

  it("paginates tasks with pull-safe list options", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        googleResponse({
          items: [{ id: "task-1", title: "First" }],
          nextPageToken: "next-tasks",
        }),
      )
      .mockResolvedValueOnce(
        googleResponse({ items: [{ id: "task-2", title: "Second" }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listGoogleTasks("access-token", "list/with slash", {
        updatedMin: "2026-05-11T12:00:00.000Z",
      }),
    ).resolves.toHaveLength(2);

    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string);
    const secondUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(firstUrl.pathname).toBe("/tasks/v1/lists/list%2Fwith%20slash/tasks");
    expect(firstUrl.searchParams.get("maxResults")).toBe("100");
    expect(firstUrl.searchParams.get("showCompleted")).toBe("true");
    expect(firstUrl.searchParams.get("showDeleted")).toBe("true");
    expect(firstUrl.searchParams.get("showHidden")).toBe("true");
    expect(firstUrl.searchParams.get("updatedMin")).toBe(
      "2026-05-11T12:00:00.000Z",
    );
    expect(secondUrl.searchParams.get("pageToken")).toBe("next-tasks");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: "Bearer access-token" },
    });
  });
});
