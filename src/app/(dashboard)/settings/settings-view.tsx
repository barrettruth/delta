"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  generateInviteAction,
  type InviteLinkRow,
  listInvitesAction,
} from "@/app/actions/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Passkey {
  id: number;
  name: string;
  createdAt: string;
}

interface ConnectedAccount {
  id: number;
  provider: string;
  providerAccountId: string;
  email: string | null;
  createdAt: string;
}

interface IntegrationSummary {
  provider: string;
  enabled: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

const INTEGRATION_PROVIDERS = [
  { id: "google_calendar", label: "google calendar", type: "oauth" as const },
  { id: "mapbox", label: "mapbox", type: "api_key" as const },
] as const;

export function SettingsView({
  username,
  passkeys: initialPasskeys,
  totpEnabled: initialTotpEnabled,
  recoveryCodesRemaining: initialRecoveryRemaining,
  connectedAccounts: initialConnectedAccounts,
  enabledProviders,
  integrations: initialIntegrations,
}: {
  username: string;
  passkeys: Passkey[];
  totpEnabled: boolean;
  recoveryCodesRemaining: number;
  connectedAccounts: ConnectedAccount[];
  enabledProviders: string[];
  integrations: IntegrationSummary[];
}) {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [totpEnabled, setTotpEnabled] = useState(initialTotpEnabled);
  const [recoveryRemaining, setRecoveryRemaining] = useState(
    initialRecoveryRemaining,
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [connectedAccounts, setConnectedAccounts] = useState(
    initialConnectedAccounts,
  );

  const [showAddPasskey, setShowAddPasskey] = useState(false);
  const [passkeyName, setPasskeyName] = useState("");
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [invites, setInvites] = useState<InviteLinkRow[]>([]);
  const [invitesLoaded, setInvitesLoaded] = useState(false);
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [expandedApiKey, setExpandedApiKey] = useState<string | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState("");

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    setError("");
    setTimeout(() => setMessage(""), 3000);
  }, []);

  const flashError = useCallback((msg: string) => {
    setError(msg);
    setMessage("");
    setTimeout(() => setError(""), 5000);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleAddPasskey() {
    try {
      const optionsRes = await fetch("/api/auth/webauthn/register");
      const options = await optionsRes.json();
      const registration = await startRegistration({ optionsJSON: options });
      const res = await fetch("/api/auth/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: passkeyName || "passkey",
          response: registration,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        flashError(data.error ?? "Failed to add passkey");
        return;
      }
      setShowAddPasskey(false);
      setPasskeyName("");
      flash("passkey added");
      router.refresh();
    } catch (e) {
      flashError(e instanceof Error ? e.message : "Failed to add passkey");
    }
  }

  async function handleRemovePasskey(id: number) {
    const res = await fetch(`/api/auth/webauthn/register?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      flashError(data.error ?? "Failed to remove passkey");
      return;
    }
    setPasskeys((prev) => prev.filter((p) => p.id !== id));
    flash("passkey removed");
  }

  async function handleTotpToggle() {
    if (totpEnabled) {
      const res = await fetch("/api/auth/totp/setup", { method: "DELETE" });
      if (!res.ok) {
        flashError("Failed to disable authenticator");
        return;
      }
      setTotpEnabled(false);
      flash("authenticator disabled");
    } else {
      const res = await fetch("/api/auth/totp/setup");
      const data = await res.json();
      setQrCode(data.qrCode);
      setTotpSecret(data.secret);
      setShowTotpSetup(true);
    }
  }

  async function handleTotpVerify() {
    const res = await fetch("/api/auth/totp/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: totpToken }),
    });
    if (!res.ok) {
      const data = await res.json();
      flashError(data.error ?? "Invalid code");
      return;
    }
    setTotpEnabled(true);
    setShowTotpSetup(false);
    setTotpToken("");
    flash("authenticator enabled");
  }

  async function handleRegenerateRecovery() {
    const res = await fetch("/api/auth/recovery-codes", { method: "POST" });
    const data = await res.json();
    setRecoveryCodes(data.codes);
    setRecoveryRemaining(data.codes.length);
    setShowRecoveryCodes(true);
  }

  async function handleUnlinkProvider(provider: string) {
    const res = await fetch(`/api/auth/unlink/${provider}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      flashError(data.error ?? "Failed to unlink provider");
      return;
    }
    setConnectedAccounts((prev) => prev.filter((a) => a.provider !== provider));
    flash(`${provider} unlinked`);
  }

  function getInviteUrl(token: string): string {
    return `${window.location.origin}/invite/${token}`;
  }

  async function handleGenerateInvite() {
    const result = await generateInviteAction();
    if ("error" in result) {
      flashError(result.error);
      return;
    }
    flash("invite link generated");
    await loadInvites();
  }

  const loadInvites = useCallback(async () => {
    const result = await listInvitesAction();
    if ("data" in result) {
      setInvites(result.data);
      setInvitesLoaded(true);
    }
  }, []);

  async function handleCopyInviteUrl(token: string) {
    await navigator.clipboard.writeText(getInviteUrl(token));
    flash("copied to clipboard");
  }

  async function handleConnectApiKey(provider: string) {
    if (!apiKeyValue.trim()) return;
    const res = await fetch("/api/settings/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        tokens: { api_key: apiKeyValue.trim() },
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      flashError(data.error ?? "Failed to connect");
      return;
    }
    const data = await res.json();
    setIntegrations((prev) => [
      ...prev,
      {
        provider: data.provider,
        enabled: data.enabled,
        metadata: data.metadata,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    ]);
    setExpandedApiKey(null);
    setApiKeyValue("");
    flash(`${provider} connected`);
  }

  async function handleDisconnectIntegration(provider: string) {
    const res = await fetch(`/api/settings/integrations/${provider}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      flashError(data.error ?? "Failed to disconnect");
      return;
    }
    setIntegrations((prev) => prev.filter((i) => i.provider !== provider));
    flash(`${provider} disconnected`);
  }

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  useEffect(() => {
    if (!showRecoveryCodes) return;
    const id = setTimeout(() => setShowRecoveryCodes(false), 30_000);
    return () => clearTimeout(id);
  }, [showRecoveryCodes]);

  return (
    <div className="flex-1 overflow-y-auto flex justify-center">
      <div className="w-full max-w-md p-6">
        {(error || message) && (
          <div
            className={`text-sm mb-4 ${error ? "text-destructive" : "text-muted-foreground"}`}
          >
            {error || message}
          </div>
        )}

        <Section title="account">
          <Row label="username" value={username} />
          <Row label="logout" action onClick={handleLogout} />
        </Section>

        <Section title="connected accounts">
          {enabledProviders.map((provider) => {
            const linked = connectedAccounts.find(
              (a) => a.provider === provider,
            );
            if (linked) {
              return (
                <button
                  key={provider}
                  type="button"
                  className="flex items-center w-full text-sm py-1 px-2 min-w-0 hover:bg-accent/50 cursor-pointer"
                  onClick={() => handleUnlinkProvider(provider)}
                >
                  <span className="flex-1 text-left truncate min-w-0 text-destructive">
                    - unlink {provider}
                  </span>
                  <span className="text-muted-foreground text-xs truncate shrink-0">
                    {linked.email ?? linked.providerAccountId}
                  </span>
                </button>
              );
            }
            return (
              <button
                key={provider}
                type="button"
                className="flex items-center w-full text-sm py-1 px-2 min-w-0 hover:bg-accent/50 cursor-pointer"
                onClick={() => {
                  window.location.href = `/api/auth/${provider}`;
                }}
              >
                <span className="flex-1 text-left truncate min-w-0 text-status-done">
                  + link {provider}
                </span>
              </button>
            );
          })}
        </Section>

        <Section title="security">
          <div className="mb-1">
            <span className="text-xs text-muted-foreground">passkeys</span>
          </div>
          {passkeys.map((pk) => (
            <Row
              key={pk.id}
              label={`  ${pk.name}`}
              value={pk.createdAt.slice(0, 10)}
              action
              onClick={() => handleRemovePasskey(pk.id)}
            />
          ))}
          {showAddPasskey ? (
            <div className="flex gap-2 ml-4 mb-2">
              <Input
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                placeholder="key name"
                autoFocus
                className="h-7 text-sm flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddPasskey();
                  if (e.key === "Escape") setShowAddPasskey(false);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddPasskey}
                className="h-7 text-xs"
              >
                add
              </Button>
            </div>
          ) : (
            <Row
              label="  + add passkey"
              action
              muted
              onClick={() => setShowAddPasskey(true)}
            />
          )}

          {showTotpSetup ? (
            <div className="pt-2 mt-2">
              <div className="flex flex-col items-center gap-2 mb-2">
                {qrCode && (
                  // biome-ignore lint/performance/noImgElement: data URI QR code
                  <img src={qrCode} alt="TOTP QR" className="w-36 h-36" />
                )}
                <code className="text-xs text-muted-foreground break-all select-all">
                  {totpSecret}
                </code>
              </div>
              <div className="flex gap-2 ml-4 mb-2">
                <Input
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value)}
                  placeholder="6-digit code"
                  autoFocus
                  maxLength={6}
                  className="h-7 text-sm flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTotpVerify();
                    if (e.key === "Escape") setShowTotpSetup(false);
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTotpVerify}
                  className="h-7 text-xs"
                >
                  verify
                </Button>
              </div>
            </div>
          ) : (
            <Row
              label="authenticator"
              value={totpEnabled ? "enabled" : "disabled"}
              action
              onClick={handleTotpToggle}
            />
          )}

          {showRecoveryCodes ? (
            <div className="mt-2 mb-2">
              <div className="border border-border p-3 font-mono text-sm leading-relaxed select-all text-center">
                {recoveryCodes.map((code) => (
                  <div key={code}>{code}</div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRecoveryCodes(false)}
                className="w-full mt-2 h-7 text-xs"
              >
                I've saved these codes
              </Button>
            </div>
          ) : (
            <Row
              label="recovery codes"
              value={`${recoveryRemaining} remaining`}
              action
              onClick={handleRegenerateRecovery}
            />
          )}
        </Section>

        <Section title="invites">
          {invitesLoaded && invites.length > 0 ? (
            (() => {
              const active = invites.find((inv) => {
                const expired = new Date(inv.expiresAt) < new Date();
                const exhausted = inv.useCount >= inv.maxUses;
                return !expired && !exhausted;
              });
              if (active) {
                return (
                  <button
                    type="button"
                    className="flex items-center w-full text-sm py-1 px-2 min-w-0 hover:bg-accent/50 cursor-pointer"
                    onClick={() => handleCopyInviteUrl(active.token)}
                  >
                    <span className="flex-1 text-left truncate min-w-0 text-muted-foreground">
                      copy invite link
                    </span>
                    <span className="text-muted-foreground text-xs shrink-0">
                      {active.useCount}/{active.maxUses} uses
                    </span>
                  </button>
                );
              }
              return (
                <Row
                  label="+ generate invite link"
                  action
                  muted
                  onClick={handleGenerateInvite}
                />
              );
            })()
          ) : (
            <Row
              label="+ generate invite link"
              action
              muted
              onClick={handleGenerateInvite}
            />
          )}
        </Section>

        <Section title="integrations">
          {INTEGRATION_PROVIDERS.map((provider) => {
            const connected = integrations.find(
              (i) => i.provider === provider.id,
            );
            if (connected) {
              return (
                <button
                  key={provider.id}
                  type="button"
                  className="flex items-center w-full text-sm py-1 px-2 min-w-0 hover:bg-accent/50 cursor-pointer"
                  onClick={() => handleDisconnectIntegration(provider.id)}
                >
                  <span className="flex-1 text-left truncate min-w-0 text-destructive">
                    - disconnect {provider.label}
                  </span>
                </button>
              );
            }
            if (provider.type === "api_key" && expandedApiKey === provider.id) {
              return (
                <div key={provider.id} className="flex gap-2 ml-4 mb-2">
                  <Input
                    value={apiKeyValue}
                    onChange={(e) => setApiKeyValue(e.target.value)}
                    placeholder="api key"
                    autoFocus
                    className="h-7 text-sm flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConnectApiKey(provider.id);
                      if (e.key === "Escape") {
                        setExpandedApiKey(null);
                        setApiKeyValue("");
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnectApiKey(provider.id)}
                    className="h-7 text-xs"
                  >
                    save
                  </Button>
                </div>
              );
            }
            return (
              <button
                key={provider.id}
                type="button"
                className="flex items-center w-full text-sm py-1 px-2 min-w-0 hover:bg-accent/50 cursor-pointer"
                onClick={() => {
                  if (provider.type === "api_key") {
                    setExpandedApiKey(provider.id);
                    setApiKeyValue("");
                  } else {
                    window.location.href =
                      "/api/auth/google?scope=calendar.events";
                  }
                }}
              >
                <span className="flex-1 text-left truncate min-w-0 text-status-done">
                  + connect {provider.label}
                </span>
              </button>
            );
          })}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pb-4 mb-4">
      <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  action,
  muted,
  onClick,
}: {
  label: string;
  value?: string;
  action?: boolean;
  muted?: boolean;
  onClick?: () => void;
}) {
  const Tag = action ? "button" : "div";
  return (
    <Tag
      className={`flex items-center w-full text-sm py-1 px-2 overflow-hidden min-w-0 ${action ? "hover:bg-accent/50 cursor-pointer" : ""}`}
      onClick={onClick}
      type={action ? "button" : undefined}
    >
      <span
        className={`flex-1 text-left truncate min-w-0 ${muted ? "text-muted-foreground" : "text-foreground"}`}
      >
        {label}
      </span>
      {value && <span className="text-muted-foreground shrink-0">{value}</span>}
    </Tag>
  );
}
