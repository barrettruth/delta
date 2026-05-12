import { describe, expect, it, vi } from "vitest";
import { getFeedToken, getUserByFeedToken } from "@/core/calendar-feed";
import {
  type ApiRouteTestState,
  apiRequest,
  installApiRouteTestHarness,
  responseJson,
} from "./helpers";

const state = vi.hoisted(
  (): ApiRouteTestState => ({
    db: undefined as unknown as ApiRouteTestState["db"],
    user: undefined as unknown as ApiRouteTestState["user"],
  }),
);

installApiRouteTestHarness(state, {
  auth: "local-owner",
  username: "feedapi",
});

describe("/api/calendar/feed", () => {
  it("generates, reads, rotates, and revokes the owner feed token", async () => {
    const { DELETE, GET, POST } = await import("@/app/api/calendar/feed/route");

    await expect(responseJson(await GET())).resolves.toEqual({ token: null });

    const firstResponse = await POST();
    expect(firstResponse.status).toBe(200);
    const first = await responseJson<{ token: string }>(firstResponse);

    expect(first.token).toMatch(/^[a-f0-9]{64}$/);
    expect(getFeedToken(state.db, state.user.id)).toBe(first.token);

    const second = await responseJson<{ token: string }>(await POST());

    expect(second.token).not.toBe(first.token);
    expect(getFeedToken(state.db, state.user.id)).toBe(second.token);
    expect(getUserByFeedToken(state.db, first.token)).toBeNull();

    const deleteResponse = await DELETE();

    expect(deleteResponse.status).toBe(200);
    await expect(responseJson(deleteResponse)).resolves.toEqual({
      token: null,
    });
    expect(getFeedToken(state.db, state.user.id)).toBeNull();
    expect(getUserByFeedToken(state.db, second.token)).toBeNull();
  });
});

describe("/api/calendar/feed/[token]", () => {
  it("serves the same public feed URL contract for the stored token", async () => {
    const privateRoute = await import("@/app/api/calendar/feed/route");
    const publicRoute = await import("@/app/api/calendar/feed/[token]/route");
    const { token } = await responseJson<{ token: string }>(
      await privateRoute.POST(),
    );

    const response = await publicRoute.GET(
      apiRequest(`/api/calendar/feed/${token}`),
      {
        params: Promise.resolve({ token }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'inline; filename="delta.ics"',
    );
    await expect(response.text()).resolves.toContain("BEGIN:VCALENDAR");
  });

  it("rejects stale or missing feed tokens", async () => {
    const privateRoute = await import("@/app/api/calendar/feed/route");
    const publicRoute = await import("@/app/api/calendar/feed/[token]/route");
    const { token } = await responseJson<{ token: string }>(
      await privateRoute.POST(),
    );
    await privateRoute.DELETE();

    const response = await publicRoute.GET(
      apiRequest(`/api/calendar/feed/${token}`),
      {
        params: Promise.resolve({ token }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Not Found");
  });
});
