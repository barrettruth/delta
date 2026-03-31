"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateInviteAction,
  type InviteLinkRow,
  listInvitesAction,
} from "@/app/actions/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStatusBar } from "@/contexts/status-bar";
import type { NlpProvider } from "@/lib/nlp-models";

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
  name: string | null;
  createdAt: string;
}

interface NlpConfig {
  activeProvider: NlpProvider | null;
  anthropicConfigured: boolean;
  openaiConfigured: boolean;
}

export function SettingsView({
  username,
  passkeys: initialPasskeys,
  totpEnabled: initialTotpEnabled,
  recoveryCodesRemaining: initialRecoveryRemaining,
  connectedAccounts: initialConnectedAccounts,
  enabledProviders,
  nlpConfig: initialNlpConfig,
}: {
  username: string;
  passkeys: Passkey[];
  totpEnabled: boolean;
  recoveryCodesRemaining: number;
  connectedAccounts: ConnectedAccount[];
  enabledProviders: string[];
  nlpConfig: NlpConfig;
}) {
  const router = useRouter();
  const statusBar = useStatusBar();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const headings = container.querySelectorAll<HTMLElement>("[data-section]");
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(
              (entry.target as HTMLElement).dataset.section ?? "",
            );
          }
        }
      },
      { root: container, rootMargin: "0px 0px -80% 0px", threshold: 0 },
    );

    for (const h of headings) observer.observe(h);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const label = activeSection
      ? `-- SETTINGS -- ${activeSection}`
      : "-- SETTINGS --";
    statusBar.setIdle(label, "");
  }, [activeSection, statusBar.setIdle]);

  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [totpEnabled, setTotpEnabled] = useState(initialTotpEnabled);
  const [recoveryRemaining, setRecoveryRemaining] = useState(
    initialRecoveryRemaining,
  );

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

  const [nlpMode, setNlpMode] = useState<"builtin" | "llm">(
    initialNlpConfig.activeProvider ? "llm" : "builtin",
  );
  const [nlpActiveProvider, setNlpActiveProvider] =
    useState<NlpProvider | null>(initialNlpConfig.activeProvider);
  const [nlpApiKey, setNlpApiKey] = useState("");
  const [nlpAnthropicConfigured, setNlpAnthropicConfigured] = useState(
    initialNlpConfig.anthropicConfigured,
  );
  const [nlpOpenaiConfigured, setNlpOpenaiConfigured] = useState(
    initialNlpConfig.openaiConfigured,
  );

  async function handleSetBuiltinMode() {
    const res = await fetch("/api/settings/nlp", { method: "DELETE" });
    if (!res.ok) {
      statusBar.error("failed to switch to built-in mode");
      return;
    }
    setNlpMode("builtin");
    setNlpActiveProvider(null);
    setNlpAnthropicConfigured(false);
    setNlpOpenaiConfigured(false);
    setNlpApiKey("");
    statusBar.message("switched to built-in parsing");
  }

  async function handleSelectNlpProvider(provider: NlpProvider) {
    const isConfigured =
      provider === "anthropic" ? nlpAnthropicConfigured : nlpOpenaiConfigured;

    if (isConfigured) {
      const res = await fetch("/api/settings/nlp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        statusBar.error("failed to switch provider");
        return;
      }
    }

    setNlpMode("llm");
    setNlpActiveProvider(provider);
    setNlpApiKey("");

    if (isConfigured) {
      statusBar.message(`switched to ${provider}`);
    }
  }

  async function handleSaveNlpConfig() {
    if (!nlpActiveProvider) return;

    const body: Record<string, string> = { provider: nlpActiveProvider };
    if (nlpApiKey) {
      body.apiKey = nlpApiKey;
    }

    const res = await fetch("/api/settings/nlp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      statusBar.error(data.error ?? "failed to save nlp config");
      return;
    }

    if (nlpActiveProvider === "anthropic") {
      setNlpAnthropicConfigured(true);
    } else {
      setNlpOpenaiConfigured(true);
    }
    setNlpApiKey("");
    statusBar.message(`${nlpActiveProvider} config saved`);
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
        statusBar.error(data.error ?? "failed to add passkey");
        return;
      }
      setShowAddPasskey(false);
      setPasskeyName("");
      statusBar.message("passkey added");
      router.refresh();
    } catch (e) {
      statusBar.error(e instanceof Error ? e.message : "failed to add passkey");
    }
  }

  async function handleRemovePasskey(id: number) {
    const res = await fetch(`/api/auth/webauthn/register?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      statusBar.error(data.error ?? "failed to remove passkey");
      return;
    }
    setPasskeys((prev) => prev.filter((p) => p.id !== id));
    statusBar.message("passkey removed");
  }

  async function handleTotpToggle() {
    if (totpEnabled) {
      const res = await fetch("/api/auth/totp/setup", { method: "DELETE" });
      if (!res.ok) {
        statusBar.error("failed to disable authenticator");
        return;
      }
      setTotpEnabled(false);
      statusBar.message("authenticator disabled");
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
      statusBar.error(data.error ?? "invalid code");
      return;
    }
    setTotpEnabled(true);
    setShowTotpSetup(false);
    setTotpToken("");
    statusBar.message("authenticator enabled");
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
      statusBar.error(data.error ?? "failed to unlink provider");
      return;
    }
    setConnectedAccounts((prev) => prev.filter((a) => a.provider !== provider));
    statusBar.message(`${provider} unlinked`);
  }

  function getInviteUrl(token: string): string {
    return `${window.location.origin}/invite/${token}`;
  }

  async function handleGenerateInvite() {
    const result = await generateInviteAction();
    if ("error" in result) {
      statusBar.error(result.error);
      return;
    }
    statusBar.message("invite link generated");
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
    statusBar.message("copied to clipboard");
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
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto flex items-center justify-center"
    >
      <div className="w-full max-w-md px-4 py-4 md:p-6">
        <Section title="account">
          <Row label="username" value={username} />
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
                  className="flex items-center w-full text-sm py-2 md:py-1 px-2 min-w-0 hover:bg-accent/50 cursor-pointer"
                  onClick={() => handleUnlinkProvider(provider)}
                >
                  <span className="flex-1 text-left truncate min-w-0 text-muted-foreground">
                    <span className="text-destructive">-</span> {provider}
                  </span>
                  <span className="text-muted-foreground text-xs truncate shrink-0">
                    {linked.name ?? linked.email ?? linked.providerAccountId}
                  </span>
                </button>
              );
            }
            return (
              <button
                key={provider}
                type="button"
                className="flex items-center w-full text-sm py-2 md:py-1 px-2 min-w-0 hover:bg-accent/50 cursor-pointer"
                onClick={() => {
                  window.location.href = `/api/auth/${provider}`;
                }}
              >
                <span className="flex-1 text-left truncate min-w-0 text-muted-foreground">
                  <span className="text-status-done">+</span> {provider}
                </span>
              </button>
            );
          })}
        </Section>

        <Section title="security">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">passkeys</span>
            {!showAddPasskey && (
              <button
                type="button"
                className="text-xs text-muted-foreground cursor-pointer"
                onClick={() => setShowAddPasskey(true)}
              >
                +
              </button>
            )}
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
          {showAddPasskey && (
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
                    className="flex items-center w-full text-sm py-2 md:py-1 px-2 min-w-0 hover:bg-accent/50 cursor-pointer"
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

        <Section title="recurrence API">
          <Row
            label="built-in only"
            value={nlpMode === "builtin" ? "active" : ""}
            action
            onClick={handleSetBuiltinMode}
          />
          <Row
            label="llm-assisted"
            value={nlpMode === "llm" ? "active" : ""}
            action
            onClick={() => {
              if (nlpMode !== "llm") {
                setNlpMode("llm");
                if (!nlpActiveProvider) setNlpActiveProvider("anthropic");
              }
            }}
          />

          {nlpMode === "llm" && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2 px-2">
                {(["anthropic", "openai"] as const).map((p) => {
                  const isActive = nlpActiveProvider === p;
                  const isConfigured =
                    p === "anthropic"
                      ? nlpAnthropicConfigured
                      : nlpOpenaiConfigured;
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`flex-1 border px-2 py-1.5 text-sm transition-colors cursor-pointer ${
                        isActive
                          ? "border-foreground text-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/50"
                      }`}
                      onClick={() => handleSelectNlpProvider(p)}
                    >
                      <span>{p}</span>
                      {isConfigured && (
                        <span className="ml-1.5 text-xs text-status-done">
                          {isActive ? "active" : "configured"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {nlpActiveProvider && (
                <div className="space-y-2 px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-12 shrink-0">
                      key
                    </span>
                    <Input
                      type="password"
                      value={nlpApiKey}
                      onChange={(e) => setNlpApiKey(e.target.value)}
                      placeholder={
                        (
                          nlpActiveProvider === "anthropic"
                            ? nlpAnthropicConfigured
                            : nlpOpenaiConfigured
                        )
                          ? "••••••••"
                          : "api key"
                      }
                      className="h-7 text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveNlpConfig();
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveNlpConfig}
                      className="h-7 text-xs"
                    >
                      save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
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
      <h2
        data-section={title}
        className="text-xs text-muted-foreground uppercase tracking-wider mb-3"
      >
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
      className={`flex items-center w-full text-sm py-2 md:py-1 px-2 overflow-hidden min-w-0 ${action ? "hover:bg-accent/50 cursor-pointer" : ""}`}
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
