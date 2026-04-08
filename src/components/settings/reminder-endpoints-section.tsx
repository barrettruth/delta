"use client";

import { useMemo, useState } from "react";
import { ReminderDeliveryLogSection } from "@/components/settings/reminder-delivery-log-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStatusBar } from "@/contexts/status-bar";
import type { ReminderDeliveryLogRecord } from "@/core/reminders/deliveries";
import type { ReminderEndpointRecord } from "@/core/reminders/endpoints";
import type {
  ReminderAdapterKey,
  ReminderAdapterManifest,
} from "@/core/reminders/types";
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
import { SettingsSection } from "./settings-primitives";

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

function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function getReminderAdapterLabel(
  adapter: Pick<ReminderAdapterManifest, "key">,
): string {
  switch (adapter.key) {
    case "sms.twilio":
      return "SMS";
    case "whatsapp.twilio":
      return "WhatsApp";
    case "telegram.bot_api":
      return "Telegram";
    case "slack.webhook":
      return "Slack";
    case "discord.webhook":
      return "Discord";
  }
}

function getReminderAdapterDescription(
  adapter: Pick<ReminderAdapterManifest, "key">,
): string {
  switch (adapter.key) {
    case "sms.twilio":
      return "Text reminders to a phone number you control.";
    case "whatsapp.twilio":
      return "Business-initiated reminders through Twilio WhatsApp.";
    case "telegram.bot_api":
      return "Messages from your bot to a chat that has already started it.";
    case "slack.webhook":
      return "Post reminders into a Slack channel with an incoming webhook.";
    case "discord.webhook":
      return "Post reminders into a Discord channel with a webhook.";
  }
}

function getReminderAdapterStatus(input: {
  providerReady: boolean;
  destinationCount: number;
  issueCount: number;
}): { label: string; className: string } {
  if (!input.providerReady) {
    return {
      label: "needs setup",
      className: "text-muted-foreground",
    };
  }

  if (input.issueCount > 0) {
    return {
      label: formatCount(input.issueCount, "issue"),
      className: "text-destructive",
    };
  }

  if (input.destinationCount > 0) {
    return {
      label: formatCount(input.destinationCount, "destination"),
      className: "text-muted-foreground",
    };
  }

  return {
    label: "ready to add",
    className: "text-muted-foreground",
  };
}

function getInitialExpandedAdapterKey(input: {
  adapters: ReminderAdapterManifest[];
  transportConfigs: ReminderTransportConfigStatus[];
  deliveries: ReminderDeliveryLogRecord[];
  endpoints: ReminderEndpointRecord[];
}): ReminderAdapterKey | null {
  const transportConfigByKey = new Map(
    input.transportConfigs.map((config) => [config.adapterKey, config]),
  );

  for (const adapter of input.adapters) {
    if (isReminderTransportConfigurableAdapterKey(adapter.key)) {
      const status =
        transportConfigByKey.get(adapter.key) ??
        getEmptyReminderTransportConfigStatus(adapter.key);
      if (!status.configured) return adapter.key;
    }
  }

  for (const endpoint of input.endpoints) {
    if (endpoint.lastTestStatus === "failed") {
      return endpoint.adapterKey;
    }
  }

  for (const delivery of input.deliveries) {
    if (delivery.status === "failed" || delivery.status === "dead") {
      return delivery.adapterKey;
    }
  }

  return null;
}

export function ReminderEndpointsSection({
  className,
  initialDeliveries,
  initialEndpoints,
  initialTransportConfigs,
  adapters,
}: {
  className?: string;
  initialDeliveries: ReminderDeliveryLogRecord[];
  initialEndpoints: ReminderEndpointRecord[];
  initialTransportConfigs: ReminderTransportConfigStatus[];
  adapters: ReminderAdapterManifest[];
}) {
  const statusBar = useStatusBar();
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
  const [createLabel, setCreateLabel] = useState("");
  const [createTarget, setCreateTarget] = useState("");
  const [creating, setCreating] = useState(false);
  const [testingIds, setTestingIds] = useState<number[]>([]);
  const [deletingIds, setDeletingIds] = useState<number[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedAdapterKey, setExpandedAdapterKey] = useState<
    ReminderAdapterManifest["key"] | null
  >(() =>
    getInitialExpandedAdapterKey({
      adapters,
      transportConfigs: initialTransportConfigs,
      deliveries: initialDeliveries,
      endpoints: initialEndpoints,
    }),
  );

  const transportConfigByKey = useMemo(
    () =>
      new Map(transportConfigs.map((config) => [config.adapterKey, config])),
    [transportConfigs],
  );
  const deliveryIssuesByAdapter = useMemo(() => {
    const issues = new Map<ReminderAdapterManifest["key"], number>();
    for (const delivery of initialDeliveries) {
      if (delivery.status !== "failed" && delivery.status !== "dead") {
        continue;
      }
      issues.set(
        delivery.adapterKey,
        (issues.get(delivery.adapterKey) ?? 0) + 1,
      );
    }
    return issues;
  }, [initialDeliveries]);
  const totalDeliveryIssues = useMemo(
    () =>
      initialDeliveries.filter(
        (delivery) =>
          delivery.status === "failed" || delivery.status === "dead",
      ).length,
    [initialDeliveries],
  );

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
    setCreateLabel("");
    setCreateTarget("");
  }

  function handleToggleAdapter(adapterKey: ReminderAdapterManifest["key"]) {
    if (expandedAdapterKey === adapterKey) {
      setExpandedAdapterKey(null);
      if (
        editingTransportKey &&
        isReminderTransportConfigurableAdapterKey(adapterKey) &&
        editingTransportKey === adapterKey
      ) {
        resetTransportEditor();
      }
      resetCreateForm();
      return;
    }

    setExpandedAdapterKey(adapterKey);
    resetCreateForm();

    if (
      editingTransportKey &&
      (!isReminderTransportConfigurableAdapterKey(adapterKey) ||
        editingTransportKey !== adapterKey)
    ) {
      resetTransportEditor();
    }
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
      statusBar.message("provider setup saved");
    } catch {
      statusBar.error("failed to save provider setup");
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
      statusBar.message("provider setup cleared");
    } catch {
      statusBar.error("failed to clear provider setup");
    } finally {
      setDeletingTransportKey(null);
    }
  }

  async function handleCreateEndpoint(
    adapterKey: ReminderAdapterManifest["key"],
  ) {
    if (!createLabel.trim() || !createTarget.trim()) {
      statusBar.error("destination name and target are required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/reminders/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adapterKey,
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
      statusBar.message("destination saved");
    } catch {
      statusBar.error("failed to save destination");
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
      statusBar.message("destination deleted");
    } catch {
      statusBar.error("failed to delete destination");
    } finally {
      setDeletingIds((prev) => prev.filter((candidate) => candidate !== id));
    }
  }

  return (
    <SettingsSection
      className={className}
      title="reminders"
      description="Set up where delta can send reminders. Most people only need one or two destinations here."
    >
      <div className="space-y-2">
        {adapters.map((adapter) => {
          const adapterKey = adapter.key;
          const expanded = expandedAdapterKey === adapterKey;
          const configurableAdapterKey =
            isReminderTransportConfigurableAdapterKey(adapterKey)
              ? adapterKey
              : null;
          const providerSetupStatus = configurableAdapterKey
            ? (transportConfigByKey.get(configurableAdapterKey) ??
              getEmptyReminderTransportConfigStatus(configurableAdapterKey))
            : null;
          const providerReady = providerSetupStatus
            ? providerSetupStatus.configured
            : true;
          const destinations = endpoints.filter(
            (endpoint) => endpoint.adapterKey === adapterKey,
          );
          const issueCount =
            (deliveryIssuesByAdapter.get(adapterKey) ?? 0) +
            destinations.filter(
              (endpoint) => endpoint.lastTestStatus === "failed",
            ).length;
          const status = getReminderAdapterStatus({
            providerReady,
            destinationCount: destinations.length,
            issueCount,
          });
          const adapterHint = getReminderEndpointAdapterHint(adapter);
          const setupFields = configurableAdapterKey
            ? getReminderTransportFields(configurableAdapterKey)
            : [];
          const canSaveSetup =
            setupFields.length > 0 &&
            setupFields.every((field) =>
              (transportValues[field.name] ?? "").trim(),
            );
          const hasStoredSetup =
            providerSetupStatus !== null &&
            setupFields.length > 0 &&
            providerSetupStatus.missingFields.length < setupFields.length;
          const showTransportEditor =
            providerSetupStatus !== null &&
            (!providerSetupStatus.configured ||
              editingTransportKey === adapterKey);
          const targetLabel = getReminderEndpointTargetLabel(adapterKey);
          const targetPlaceholder =
            getReminderEndpointTargetPlaceholder(adapterKey);

          return (
            <div
              key={adapterKey}
              className="overflow-hidden border border-border/60"
            >
              <button
                type="button"
                className={`flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors ${
                  expanded ? "bg-accent/30" : "hover:bg-accent/30"
                }`}
                onClick={() => handleToggleAdapter(adapterKey)}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm truncate">
                      {getReminderAdapterLabel(adapter)}
                    </span>
                    {adapter.capabilities.beta && (
                      <Badge variant="outline">beta</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getReminderAdapterDescription(adapter)}
                  </div>
                </div>
                <span className={`shrink-0 text-xs ${status.className}`}>
                  {status.label}
                </span>
              </button>

              {expanded && (
                <div className="space-y-4 border-t border-border/60 px-3 py-3">
                  {providerSetupStatus && configurableAdapterKey && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
                          provider setup
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getReminderTransportStatusLabel(providerSetupStatus)}
                        </span>
                      </div>
                      {adapterHint && (
                        <div className="text-xs text-muted-foreground">
                          {adapterHint}
                        </div>
                      )}
                      {showTransportEditor ? (
                        <div className="space-y-2">
                          {!providerSetupStatus.configured && (
                            <div className="text-xs text-muted-foreground">
                              Finish provider setup before testing or sending
                              reminders.
                            </div>
                          )}
                          {setupFields.map((field, index) => (
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
                                  void handleSaveTransport(
                                    configurableAdapterKey,
                                  );
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
                              disabled={
                                savingTransportKey === adapterKey ||
                                deletingTransportKey === adapterKey ||
                                !canSaveSetup
                              }
                              onClick={() =>
                                handleSaveTransport(configurableAdapterKey)
                              }
                              className="h-7 text-xs"
                            >
                              {savingTransportKey === adapterKey
                                ? "..."
                                : "save setup"}
                            </Button>
                            {hasStoredSetup && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={
                                  savingTransportKey === adapterKey ||
                                  deletingTransportKey === adapterKey
                                }
                                onClick={() =>
                                  handleDeleteTransport(configurableAdapterKey)
                                }
                                className="h-7 text-xs"
                              >
                                {deletingTransportKey === adapterKey
                                  ? "..."
                                  : "clear"}
                              </Button>
                            )}
                            {providerSetupStatus.configured && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={
                                  savingTransportKey === adapterKey ||
                                  deletingTransportKey === adapterKey
                                }
                                onClick={resetTransportEditor}
                                className="h-7 text-xs"
                              >
                                cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            provider setup saved
                          </span>
                          {configurableAdapterKey && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                openTransportEditor(configurableAdapterKey)
                              }
                              className="h-7 text-xs"
                            >
                              replace setup
                            </Button>
                          )}
                          {hasStoredSetup && configurableAdapterKey && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={deletingTransportKey === adapterKey}
                              onClick={() =>
                                handleDeleteTransport(configurableAdapterKey)
                              }
                              className="h-7 text-xs"
                            >
                              {deletingTransportKey === adapterKey
                                ? "..."
                                : "clear"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
                        destinations
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {destinations.length > 0
                          ? formatCount(destinations.length, "destination")
                          : "none"}
                      </span>
                    </div>

                    {destinations.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        {providerReady
                          ? "no destinations yet"
                          : "save provider setup first, then add your first destination"}
                      </div>
                    ) : (
                      <div className="overflow-hidden border border-border/60 divide-y divide-border/60">
                        {destinations.map((endpoint) => {
                          const testing = testingIds.includes(endpoint.id);
                          const deleting = deletingIds.includes(endpoint.id);

                          return (
                            <div
                              key={endpoint.id}
                              className="flex items-start justify-between gap-3 px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm truncate">
                                    {endpoint.label}
                                  </span>
                                  {endpoint.enabled === 0 && (
                                    <Badge variant="ghost">off</Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {endpoint.target}
                                </div>
                                {endpoint.lastTestStatus === "failed" && (
                                  <div className="text-xs text-destructive">
                                    last test failed
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
                                  disabled={
                                    testing || deleting || !providerReady
                                  }
                                  onClick={() =>
                                    handleTestEndpoint(endpoint.id)
                                  }
                                >
                                  {testing ? "..." : "test"}
                                </Button>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="ghost"
                                  disabled={testing || deleting}
                                  onClick={() =>
                                    handleDeleteEndpoint(endpoint.id)
                                  }
                                >
                                  {deleting ? "..." : "delete"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {destinations.length > 0 && !providerReady && (
                      <div className="text-xs text-muted-foreground">
                        Restore provider setup before testing or sending
                        reminders again.
                      </div>
                    )}

                    {providerReady && (
                      <div className="space-y-2 border-t border-border/60 pt-3">
                        <Input
                          value={createLabel}
                          onChange={(event) =>
                            setCreateLabel(event.target.value)
                          }
                          placeholder="destination name"
                          className="h-8 text-sm"
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === "Enter") {
                              void handleCreateEndpoint(adapterKey);
                            }
                            if (event.key === "Escape") {
                              resetCreateForm();
                            }
                          }}
                        />
                        <Input
                          value={createTarget}
                          onChange={(event) =>
                            setCreateTarget(event.target.value)
                          }
                          placeholder={`${targetLabel}: ${targetPlaceholder}`}
                          className="h-8 text-sm"
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === "Enter") {
                              void handleCreateEndpoint(adapterKey);
                            }
                            if (event.key === "Escape") {
                              resetCreateForm();
                            }
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={creating}
                            onClick={() => handleCreateEndpoint(adapterKey)}
                            className="h-7 text-xs"
                          >
                            {creating ? "..." : "save destination"}
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
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="overflow-hidden border border-border/60">
          <button
            type="button"
            className={`flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors ${
              showAdvanced ? "bg-accent/30" : "hover:bg-accent/30"
            }`}
            onClick={() => setShowAdvanced((current) => !current)}
          >
            <div className="min-w-0 space-y-1">
              <div className="text-sm">advanced</div>
              <div className="text-xs text-muted-foreground">
                Recent sends and failures.
              </div>
            </div>
            <span
              className={`shrink-0 text-xs ${
                totalDeliveryIssues > 0
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {totalDeliveryIssues > 0
                ? formatCount(totalDeliveryIssues, "issue")
                : "quiet"}
            </span>
          </button>
          {showAdvanced && (
            <div className="border-t border-border/60 px-3 py-3">
              <ReminderDeliveryLogSection
                deliveries={initialDeliveries}
                adapters={adapters}
              />
            </div>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}
