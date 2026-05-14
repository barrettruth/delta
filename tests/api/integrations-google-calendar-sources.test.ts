import { describe, expect, it, vi } from "vitest";
import { listCategoryColors } from "@/core/categories";
import { upsertIntegrationConfig } from "@/core/integration-config";
import { listSyncSources, SYNC_SOURCE_KIND } from "@/core/sync-sources";
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
  username: "googlecalendarsapi",
  stubFetch: true,
});

function connectGoogle() {
  upsertIntegrationConfig(state.db, state.user.id, "google", {
    accessToken: "access-token",
    refreshToken: "refresh-token",
  });
}

describe("/api/integrations/google/calendar-sources", () => {
  it("discovers Google calendars through the stored Google connection", async () => {
    connectGoogle();
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        items: [
          {
            id: "work@example.com",
            summary: "Work",
            accessRole: "owner",
            backgroundColor: "#2952a3",
          },
          {
            id: "hidden@example.com",
            summary: "Hidden",
            hidden: true,
            accessRole: "reader",
            backgroundColor: "#7bd148",
          },
          {
            id: "freebusy@example.com",
            summary: "Busy",
            accessRole: "freeBusyReader",
          },
        ],
      }),
    );
    const { POST } = await import(
      "@/app/api/integrations/google/calendar-sources/route"
    );

    const response = await POST(
      apiRequest("/api/integrations/google/calendar-sources", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    const body = await responseJson<{ sources: Array<{ title: string }> }>(
      response,
    );
    expect(body.sources.map((source) => source.title)).toEqual([
      "Hidden",
      "Work",
    ]);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(
      "showHidden=true",
    );
    expect(
      listSyncSources(state.db, state.user.id, {
        provider: "google",
        sourceKind: SYNC_SOURCE_KIND.googleCalendar,
      }),
    ).toHaveLength(2);
    expect(listCategoryColors(state.db, state.user.id)).toMatchObject({
      Work: "#2952a3",
    });
  });

  it("toggles a discovered calendar source", async () => {
    connectGoogle();
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        items: [
          {
            id: "work@example.com",
            summary: "Work",
            accessRole: "owner",
          },
        ],
      }),
    );
    const listRoute = await import(
      "@/app/api/integrations/google/calendar-sources/route"
    );
    await listRoute.POST(
      apiRequest("/api/integrations/google/calendar-sources", {
        method: "POST",
      }),
    );
    const source = listSyncSources(state.db, state.user.id, {
      provider: "google",
      sourceKind: SYNC_SOURCE_KIND.googleCalendar,
    })[0];
    const { PATCH } = await import(
      "@/app/api/integrations/google/calendar-sources/[sourceId]/route"
    );

    const response = await PATCH(
      apiRequest(`/api/integrations/google/calendar-sources/${source.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
      { params: Promise.resolve({ sourceId: String(source.id) }) },
    );

    expect(response.status).toBe(200);
    await expect(responseJson(response)).resolves.toMatchObject({
      title: "Work",
      enabled: false,
    });
  });
});
