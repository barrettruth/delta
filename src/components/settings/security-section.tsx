"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStatusBar } from "@/contexts/status-bar";
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "./settings-primitives";

interface Passkey {
  id: number;
  name: string;
  createdAt: string;
}

export function SecuritySection({
  passkeys: initialPasskeys,
  totpEnabled: initialTotpEnabled,
  recoveryCodesRemaining: initialRecoveryRemaining,
}: {
  passkeys: Passkey[];
  totpEnabled: boolean;
  recoveryCodesRemaining: number;
}) {
  const router = useRouter();
  const statusBar = useStatusBar();

  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [totpEnabled, setTotpEnabled] = useState(initialTotpEnabled);
  const [recoveryRemaining, setRecoveryRemaining] = useState(
    initialRecoveryRemaining,
  );

  const [showAddPasskey, setShowAddPasskey] = useState(false);
  const [passkeyName, setPasskeyName] = useState("");
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

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

  useEffect(() => {
    if (!showRecoveryCodes) return;
    const id = setTimeout(() => setShowRecoveryCodes(false), 30_000);
    return () => clearTimeout(id);
  }, [showRecoveryCodes]);

  return (
    <SettingsPage
      className="max-w-3xl"
      title="security"
      description="Manage passkeys, your authenticator, and recovery access."
    >
      <SettingsSection
        title="passkeys"
        description="Register WebAuthn credentials for passwordless sign-in."
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground px-2">registered</span>
          {!showAddPasskey && (
            <button
              type="button"
              className="text-xs text-muted-foreground cursor-pointer px-2"
              onClick={() => setShowAddPasskey(true)}
            >
              +
            </button>
          )}
        </div>
        {passkeys.map((pk) => (
          <SettingsRow
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
      </SettingsSection>

      <SettingsSection
        title="authenticator"
        description="Enable time-based one-time passwords for an additional factor."
      >
        {showTotpSetup ? (
          <div className="pt-2">
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
          <SettingsRow
            label="TOTP"
            value={totpEnabled ? "enabled" : "disabled"}
            action
            onClick={handleTotpToggle}
          />
        )}
      </SettingsSection>

      <SettingsSection
        title="recovery codes"
        description="Regenerate and store emergency recovery codes in a safe place."
      >
        {showRecoveryCodes ? (
          <div className="mb-2">
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
          <SettingsRow
            label="regenerate"
            value={`${recoveryRemaining} remaining`}
            action
            onClick={handleRegenerateRecovery}
          />
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
