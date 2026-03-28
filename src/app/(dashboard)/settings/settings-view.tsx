"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

export function SettingsView({
  username,
  passkeys: initialPasskeys,
  totpEnabled: initialTotpEnabled,
  recoveryCodesRemaining: initialRecoveryRemaining,
  calendarFeedToken: initialFeedToken,
  connectedAccounts: initialConnectedAccounts,
  enabledProviders,
}: {
  username: string;
  passkeys: Passkey[];
  totpEnabled: boolean;
  recoveryCodesRemaining: number;
  calendarFeedToken: string | null;
  connectedAccounts: ConnectedAccount[];
  enabledProviders: string[];
}) {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [totpEnabled, setTotpEnabled] = useState(initialTotpEnabled);
  const [recoveryRemaining, setRecoveryRemaining] = useState(
    initialRecoveryRemaining,
  );
  const [feedToken, setFeedToken] = useState(initialFeedToken);
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

  function getFeedUrl(token: string): string {
    return `${window.location.origin}/api/calendar/feed/${token}`;
  }

  async function handleGenerateFeed() {
    const res = await fetch("/api/calendar/feed", { method: "POST" });
    const data = await res.json();
    setFeedToken(data.token);
    flash("feed URL generated");
  }

  async function handleRevokeFeed() {
    await fetch("/api/calendar/feed", { method: "DELETE" });
    setFeedToken(null);
    flash("feed URL revoked");
  }

  async function handleCopyFeedUrl() {
    if (!feedToken) return;
    await navigator.clipboard.writeText(getFeedUrl(feedToken));
    flash("copied to clipboard");
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case "q":
          e.preventDefault();
          handleLogout();
          break;
        case "a":
          e.preventDefault();
          setShowAddPasskey(true);
          break;
        case "t":
          e.preventDefault();
          handleTotpToggle();
          break;
        case "r":
          e.preventDefault();
          handleRegenerateRecovery();
          break;
        case "c":
          e.preventDefault();
          if (feedToken) {
            handleCopyFeedUrl();
          } else {
            handleGenerateFeed();
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

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
          <Row label="logout" hint="q" action onClick={handleLogout} />
        </Section>

        <Section title="connected accounts">
          {enabledProviders.map((provider) => {
            const linked = connectedAccounts.find(
              (a) => a.provider === provider,
            );
            if (linked) {
              return (
                <div
                  key={provider}
                  className="flex items-center w-full text-sm py-1 px-2 min-w-0"
                >
                  <span className="flex-1 text-left truncate min-w-0 text-foreground">
                    {provider}
                  </span>
                  {linked.email && (
                    <span className="text-muted-foreground text-xs truncate mr-2">
                      {linked.email}
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleUnlinkProvider(provider)}
                  >
                    unlink
                  </button>
                </div>
              );
            }
            return (
              <Row
                key={provider}
                label={`+ link ${provider}`}
                action
                muted
                onClick={() => {
                  window.location.href = `/api/auth/${provider}`;
                }}
              />
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
              hint="x"
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
              hint="a"
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
              hint="t"
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
              hint="r"
              action
              onClick={handleRegenerateRecovery}
            />
          )}
        </Section>

        <Section title="calendar feed">
          {feedToken ? (
            <>
              <div className="text-xs text-muted-foreground break-all select-all px-2 py-1 border border-border mb-2 font-mono">
                {getFeedUrl(feedToken)}
              </div>
              <Row
                label="copy URL"
                hint="c"
                action
                onClick={handleCopyFeedUrl}
              />
              <Row
                label="regenerate"
                action
                muted
                onClick={handleGenerateFeed}
              />
              <Row label="disable" action muted onClick={handleRevokeFeed} />
            </>
          ) : (
            <Row
              label="enable calendar feed"
              hint="c"
              action
              muted
              onClick={handleGenerateFeed}
            />
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
  hint,
  action,
  muted,
  onClick,
}: {
  label: string;
  value?: string;
  hint?: string;
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
      {hint && (
        <kbd className="text-[10px] text-muted-foreground ml-4 shrink-0 hidden sm:inline">
          {hint}
        </kbd>
      )}
    </Tag>
  );
}
