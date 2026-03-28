"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TwoFactorMethod } from "@/core/two-factor";

type Mode = "totp" | "passkey";

export function Verify2FA({ methods }: { methods: TwoFactorMethod[] }) {
  const router = useRouter();
  const hasTotp = methods.includes("totp");
  const hasPasskey = methods.includes("webauthn");

  const [mode, setMode] = useState<Mode>(hasTotp ? "totp" : "passkey");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "totp", code }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "verification failed");
    }
    setLoading(false);
  }

  async function handlePasskey() {
    setError("");
    setLoading(true);
    try {
      const optionsRes = await fetch("/api/auth/webauthn/authenticate");
      const options = await optionsRes.json();
      const authentication = await startAuthentication({
        optionsJSON: options,
      });

      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "passkey", credential: authentication }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? "passkey verification failed");
      }
    } catch {
      setError("passkey authentication cancelled");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center">
        <span className="font-serif text-6xl text-foreground select-none mb-8">
          δ
        </span>
        <div className="flex flex-col gap-3 w-64">
          {error && <div className="text-sm text-destructive">{error}</div>}

          {mode === "totp" && (
            <form onSubmit={handleTotpSubmit} className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                enter authenticator code or recovery code
              </p>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code or recovery code"
                autoFocus
                autoComplete="off"
              />
              <Button type="submit" disabled={loading}>
                {loading ? "..." : "verify"}
              </Button>
            </form>
          )}

          {mode === "passkey" && !hasTotp && (
            <Button
              variant="outline"
              onClick={handlePasskey}
              disabled={loading}
              className="w-full"
            >
              {loading ? "..." : "verify with passkey"}
            </Button>
          )}

          {hasPasskey && mode === "totp" && (
            <Button
              variant="outline"
              onClick={() => {
                setMode("passkey");
                handlePasskey();
              }}
              disabled={loading}
              className="w-full"
            >
              use passkey instead
            </Button>
          )}

          {hasTotp && mode === "passkey" && (
            <Button
              variant="outline"
              onClick={() => setMode("totp")}
              disabled={loading}
              className="w-full"
            >
              use authenticator code instead
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
