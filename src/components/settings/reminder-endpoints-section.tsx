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
import {
  getEmptyReminderTransportConfigStatus,
  getReminderTransportFields,
  getReminderTransportStatusLabel,
  isReminderTransportConfigurableAdapterKey,
  type ReminderTransportConfigStatus,
  type ReminderTransportConfigurableAdapterKey,
} from "@/lib/reminder-transport-form";
import { SettingsRow, SettingsSection } from "./settings-primitives";

interface ApiErrorResponse {
  error?: string;
}

interface ReminderEndpointTestResponse {
  ok: true;
  providerMessageId: string | null;
}

function mergeReminderTransportStatus(
  current: ReminderTransportConfigStatus[],
  next: ReminderTransportConfigStatus,
): ReminderTransportConfigStatus[] {
  return current.some((candidate) => candidate.adapterKey === next.adapterKey)
    ? current.map((candidate) =>
        candidate.adapterKey === next.adapterKey ? next : candidate,
      )
    : [...current, next];
}

async function parseApiError(response: Response): Promise<string> {
  const body = (await response
    .json()
    .catch(() => null)) as ApiErrorResponse | null;
  return typeof body?.error === "string" ? body.error : "request failed";
}

export function ReminderEndpointsSection({
  initialEndpoints,
  initialTransportConfigs,
  adapters,
}: {
  initialEndpoints: ReminderEndpointRecord[];
  initialTransportConfigs: ReminderTransportConfigStatus[];
  adapters: ReminderAdapterManifest[];
}) {
  const statusBar = useStatusBar();
  const adapterByKey = useMemo(
    () => new Map(adapters.map((adapter) => [adapter.key, adapter])),
    [adapters],
  );
  const systemAdapters = useMemo(
    () => adapters.filter((adapter) => adapter.configScope === "system"),
    [adapters],
  );
  const [transportConfigs, setTransportConfigs] = useState(
    initialTransportConfigs,
  );
  const [editingTransportKey, setEditingTransportKey] =
    useState<ReminderTransportConfigurableAdapterKey | null>(null);
  const [transportValues, setTransportValues] = useState<
    Record<string, string>
  >({});
  const [savingTransportKey, setSavingTransportKey] =
    useState<ReminderTransportConfigurableAdapterKey | null>(null);
  const [deletingTransportKey, setDeletingTransportKey] =
    useState<ReminderTransportConfigurableAdapterKey | null>(null);
  const [endpoints, setEndpoints] = useState(initialEndpoints);
  const [creating, setCreating] = useState(false);
  const [createAdapterKey, setCreateAdapterKey] =
    useState<ReminderAdapterManifest["key"]>("slack.webhook");
  const [createLabel, setCreateLabel] = useState("");
  const [createTarget, setCreateTarget] = useState("");
  const [testingIds, setTestingIds] = useState<number[]>([]);
  const [deletingIds, setDeletingIds] = useState<number[]>([]);

  const transportConfigByKey = useMemo(
    () =>
      new Map(transportConfigs.map((config) => [config.adapterKey, config])),
    [transportConfigs],
  );
  const selectedAdapter =
    adapters.find((adapter) => adapter.key === createAdapterKey) ?? adapters[0];
  const targetLabel = getReminderEndpointTargetLabel(createAdapterKey);
  const targetPlaceholder =
    getReminderEndpointTargetPlaceholder(createAdapterKey);
  const adapterHint = selectedAdapter
    ? getReminderEndpointAdapterHint(selectedAdapter)
    : null;

  function resetTransportEditor() {
    setEditingTransportKey(null);
    setTransportValues({});
  }

  function openTransportEditor(
    adapterKey: ReminderTransportConfigurableAdapterKey,
  ) {
    setEditingTransportKey(adapterKey);
    setTransportValues(
      Object.fromEntries(
        getReminderTransportFields(adapterKey).map((field) => [field.name, ""]),
      ),
    );
  }

  function resetCreateForm() {
    setCreateAdapterKey("slack.webhook");
    setCreateLabel("");
    setCreateTarget("");
    setCreating(false);
  }

  async function handleSaveTransport(
    adapterKey: ReminderTransportConfigurableAdapterKey,
  ) {
    const fields = getReminderTransportFields(adapterKey);
    const values = Object.fromEntries(
      fields.map((field) => [field.name, transportValues[field.name] ?? ""]),
    );

    setSavingTransportKey(adapterKey);
    try {
      const response = await fetch(
        `/api/settings/reminders/transports/${adapterKey}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values }),
        },
      );
      if (!response.ok) {
        statusBar.error(await parseApiError(response));
        return;
      }

      const status = (await response.json()) as ReminderTransportConfigStatus;
      setTransportConfigs((current) =>
        mergeReminderTransportStatus(current, status),
      );
      resetTransportEditor();
      statusBar.message(
        `${adapterByKey.get(adapterKey)?.displayName ?? adapterKey} configured`,
      );
    } catch {
      statusBar.error("failed to save reminder transport config");
    } finally {
      setSavingTransportKey(null);
    }
  }

  async function handleDeleteTransport(
    adapterKey: ReminderTransportConfigurableAdapterKey,
  ) {
    setDeletingTransportKey(adapterKey);
    try {
      const response = await fetch(
        `/api/settings/reminders/transports/${adapterKey}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        statusBar.error(await parseApiError(response));
        return;
      }

      const status = (await response.json()) as ReminderTransportConfigStatus;
      setTransportConfigs((current) =>
        mergeReminderTransportStatus(current, status),
      );
      if (editingTransportKey === adapterKey) {
        resetTransportEditor();
      }
      statusBar.message(
        `${adapterByKey.get(adapterKey)?.displayName ?? adapterKey} cleared`,
      );
    } catch {
      statusBar.error("failed to delete reminder transport config");
    } finally {
      setDeletingTransportKey(null);
    }
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
        <div className="mt-1 mb-1 px-2 text-xs text-muted-foreground/60 uppercase tracking-wider">
          transport config
        </div>
        <div className="space-y-2">
          {systemAdapters.map((adapter) => {
            const adapterKey = adapter.key;
            const hint = getReminderEndpointAdapterHint(adapter);

            if (!isReminderTransportConfigurableAdapterKey(adapterKey)) {
              return (
                <div
                  key={adapterKey}
                  className="border border-border/60 px-2 py-2 space-y-1"
                >
                  <SettingsRow
                    label={adapter.displayName}
                    value={adapter.capabilities.beta ? "beta" : ""}
                    muted
                  />
                  {hint && (
                    <div className="px-2 text-xs text-muted-foreground">
                      {hint}
                    </div>
                  )}
                </div>
              );
            }

            const status =
              transportConfigByKey.get(adapterKey) ??
              getEmptyReminderTransportConfigStatus(adapterKey);
            const fields = getReminderTransportFields(adapterKey);
            const hasStoredConfig = status.missingFields.length < fields.length;
            const saving = savingTransportKey === adapterKey;
            const deleting = deletingTransportKey === adapterKey;
            const canSave = fields.every((field) =>
              (transportValues[field.name] ?? "").trim(),
            );

            return (
              <div
                key={adapterKey}
                className="border border-border/60 px-2 py-2 space-y-2"
              >
                <SettingsRow
                  label={adapter.displayName}
                  value={getReminderTransportStatusLabel(status)}
                  action
                  muted={!status.configured}
                  onClick={() =>
                    editingTransportKey === adapterKey
                      ? resetTransportEditor()
                      : openTransportEditor(adapterKey)
                  }
                />
                {editingTransportKey === adapterKey && (
                  <div className="space-y-2 px-2 pb-2">
                    {fields.map((field, index) => (
                      <Input
                        key={field.name}
                        value={transportValues[field.name] ?? ""}
                        onChange={(event) =>
                          setTransportValues((current) => ({
                            ...current,
                            [field.name]: event.target.value,
                          }))
                        }
                        type={field.inputType}
                        autoFocus={index === 0}
                        placeholder={field.placeholder}
                        className="h-8 text-sm"
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Enter") {
                            void handleSaveTransport(adapterKey);
                          }
                          if (event.key === "Escape") {
                            resetTransportEditor();
                          }
                        }}
                      />
                    ))}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving || deleting || !canSave}
                        onClick={() => handleSaveTransport(adapterKey)}
                        className="h-7 text-xs"
                      >
                        {saving ? "..." : "save transport"}
                      </Button>
                      {hasStoredConfig && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={saving || deleting}
                          onClick={() => handleDeleteTransport(adapterKey)}
                          className="h-7 text-xs"
                        >
                          {deleting ? "..." : "delete"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saving || deleting}
                        onClick={resetTransportEditor}
                        className="h-7 text-xs"
                      >
                        cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 mb-1 px-2 text-xs text-muted-foreground/60 uppercase tracking-wider">
          endpoints
        </div>
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
