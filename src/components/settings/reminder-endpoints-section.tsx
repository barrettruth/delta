"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStatusBar } from "@/contexts/status-bar";
import type { ReminderEndpointRecord } from "@/core/reminders/endpoints";
import type { ReminderAdapterManifest } from "@/core/reminders/types";
import {
  getReminderEndpointAdapterHint,
  getReminderEndpointTargetLabel,
  getReminderEndpointTargetPlaceholder,
} from "@/lib/reminder-endpoint-form";
import { SettingsSection } from "./settings-primitives";

interface ApiErrorResponse {
  error?: string;
}

interface ReminderEndpointTestResponse {
  ok: true;
  providerMessageId: string | null;
}

async function parseApiError(response: Response): Promise<string> {
  const body = (await response
    .json()
    .catch(() => null)) as ApiErrorResponse | null;
  return typeof body?.error === "string" ? body.error : "request failed";
}

export function ReminderEndpointsSection({
  initialEndpoints,
  adapters,
}: {
  initialEndpoints: ReminderEndpointRecord[];
  adapters: ReminderAdapterManifest[];
}) {
  const statusBar = useStatusBar();
  const adapterByKey = useMemo(
    () => new Map(adapters.map((adapter) => [adapter.key, adapter])),
    [adapters],
  );
  const [endpoints, setEndpoints] = useState(initialEndpoints);
  const [creating, setCreating] = useState(false);
  const [createAdapterKey, setCreateAdapterKey] =
    useState<ReminderAdapterManifest["key"]>("slack.webhook");
  const [createLabel, setCreateLabel] = useState("");
  const [createTarget, setCreateTarget] = useState("");
  const [testingIds, setTestingIds] = useState<number[]>([]);
  const [deletingIds, setDeletingIds] = useState<number[]>([]);

  const selectedAdapter =
    adapters.find((adapter) => adapter.key === createAdapterKey) ?? adapters[0];
  const targetLabel = getReminderEndpointTargetLabel(createAdapterKey);
  const targetPlaceholder =
    getReminderEndpointTargetPlaceholder(createAdapterKey);
  const adapterHint = selectedAdapter
    ? getReminderEndpointAdapterHint(selectedAdapter)
    : null;

  function resetCreateForm() {
    setCreateAdapterKey("slack.webhook");
    setCreateLabel("");
    setCreateTarget("");
    setCreating(false);
  }

  async function handleCreateEndpoint() {
    if (!createLabel.trim() || !createTarget.trim()) {
      statusBar.error("label and target are required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/reminders/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adapterKey: createAdapterKey,
          label: createLabel.trim(),
          target: createTarget.trim(),
        }),
      });
      if (!response.ok) {
        statusBar.error(await parseApiError(response));
        return;
      }

      const endpoint = (await response.json()) as ReminderEndpointRecord;
      setEndpoints((prev) => [...prev, endpoint]);
      resetCreateForm();
      statusBar.message("reminder endpoint added");
    } catch {
      statusBar.error("failed to create reminder endpoint");
    } finally {
      setCreating(false);
    }
  }

  async function handleTestEndpoint(id: number) {
    setTestingIds((prev) => [...prev, id]);
    try {
      const response = await fetch(`/api/reminders/endpoints/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const error = await parseApiError(response);
        setEndpoints((prev) =>
          prev.map((endpoint) =>
            endpoint.id === id
              ? {
                  ...endpoint,
                  lastTestAt: new Date().toISOString(),
                  lastTestStatus: "failed",
                  lastTestError: error,
                }
              : endpoint,
          ),
        );
        statusBar.error(error);
        return;
      }

      const body = (await response.json()) as ReminderEndpointTestResponse;
      setEndpoints((prev) =>
        prev.map((endpoint) =>
          endpoint.id === id
            ? {
                ...endpoint,
                lastTestAt: new Date().toISOString(),
                lastTestStatus: "ok",
                lastTestError: null,
              }
            : endpoint,
        ),
      );
      statusBar.message(
        body.providerMessageId ? "test sent" : "test sent without provider id",
      );
    } catch {
      statusBar.error("failed to test reminder endpoint");
    } finally {
      setTestingIds((prev) => prev.filter((candidate) => candidate !== id));
    }
  }

  async function handleDeleteEndpoint(id: number) {
    setDeletingIds((prev) => [...prev, id]);
    try {
      const response = await fetch(`/api/reminders/endpoints/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        statusBar.error(await parseApiError(response));
        return;
      }

      setEndpoints((prev) => prev.filter((endpoint) => endpoint.id !== id));
      statusBar.message("reminder endpoint deleted");
    } catch {
      statusBar.error("failed to delete reminder endpoint");
    } finally {
      setDeletingIds((prev) => prev.filter((candidate) => candidate !== id));
    }
  }

  return (
    <SettingsSection title="reminders">
      <div className="space-y-2">
        {endpoints.length === 0 ? (
          <div className="px-2 py-2 text-sm text-muted-foreground">
            no reminder endpoints yet
          </div>
        ) : (
          endpoints.map((endpoint) => {
            const adapter = adapterByKey.get(endpoint.adapterKey);
            const hint = adapter
              ? getReminderEndpointAdapterHint(adapter)
              : null;
            const testing = testingIds.includes(endpoint.id);
            const deleting = deletingIds.includes(endpoint.id);

            return (
              <div
                key={endpoint.id}
                className="border border-border/60 px-2 py-2 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm truncate">{endpoint.label}</span>
                      {adapter?.capabilities.beta && (
                        <Badge variant="outline">beta</Badge>
                      )}
                      {endpoint.enabled === 0 && (
                        <Badge variant="ghost">off</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {adapter?.displayName ?? endpoint.adapterKey} ·{" "}
                      {endpoint.target}
                    </div>
                    {hint && (
                      <div className="text-xs text-muted-foreground truncate">
                        {hint}
                      </div>
                    )}
                    {endpoint.lastTestStatus && (
                      <div
                        className={`text-xs ${
                          endpoint.lastTestStatus === "ok"
                            ? "text-muted-foreground"
                            : "text-destructive"
                        }`}
                      >
                        last test {endpoint.lastTestStatus}
                        {endpoint.lastTestError
                          ? ` · ${endpoint.lastTestError}`
                          : ""}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={testing || deleting}
                      onClick={() => handleTestEndpoint(endpoint.id)}
                    >
                      {testing ? "..." : "test"}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={testing || deleting}
                      onClick={() => handleDeleteEndpoint(endpoint.id)}
                    >
                      {deleting ? "..." : "delete"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div className="border border-border/60 px-2 py-2 space-y-2">
          <div className="text-xs text-muted-foreground/60 uppercase tracking-wider">
            add endpoint
          </div>
          <div className="space-y-2">
            <Select
              value={createAdapterKey}
              onValueChange={(value) => {
                if (!value) return;
                setCreateAdapterKey(value as ReminderAdapterManifest["key"]);
              }}
            >
              <SelectTrigger size="sm" className="h-8 text-sm w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {adapters.map((adapter) => (
                  <SelectItem key={adapter.key} value={adapter.key}>
                    {adapter.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={createLabel}
              onChange={(e) => setCreateLabel(e.target.value)}
              placeholder="label"
              className="h-8 text-sm"
            />
            <Input
              value={createTarget}
              onChange={(e) => setCreateTarget(e.target.value)}
              placeholder={`${targetLabel}: ${targetPlaceholder}`}
              className="h-8 text-sm"
            />
            {adapterHint && (
              <div className="text-xs text-muted-foreground">{adapterHint}</div>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={creating}
                onClick={handleCreateEndpoint}
                className="h-7 text-xs"
              >
                {creating ? "..." : "save endpoint"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={creating}
                onClick={resetCreateForm}
                className="h-7 text-xs"
              >
                clear
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
