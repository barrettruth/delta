"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Step = "choose" | "passkey" | "totp-qr" | "totp-verify" | "recovery";

export function SetupTwoFactor({ username }: { username: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [passkeyName, setPasskeyName] = useState("");

  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpToken, setTotpToken] = useState("");

  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [codesConfirmed, setCodesConfirmed] = useState(false);

  async function handlePasskeySetup() {
    setError("");
    setLoading(true);
    try {
      const optionsRes = await fetch("/api/auth/webauthn/register");
      const options = await optionsRes.json();

      const registration = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: passkeyName || "passkey",
          response: registration,
        }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        setError(data.error ?? "Registration failed");
        setLoading(false);
        return;
      }

      await generateRecoveryCodes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Passkey registration failed");
    }
    setLoading(false);
  }

  async function handleTotpStart() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/totp/setup");
      const data = await res.json();
      setQrCode(data.qrCode);
      setTotpSecret(data.secret);
      setStep("totp-qr");
    } catch {
      setError("Failed to start TOTP setup");
    }
    setLoading(false);
  }

  async function handleTotpVerify() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/totp/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: totpToken }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Verification failed");
        setLoading(false);
        return;
      }

      await generateRecoveryCodes();
    } catch {
      setError("Verification failed");
    }
    setLoading(false);
  }

  async function generateRecoveryCodes() {
    const res = await fetch("/api/auth/recovery-codes", { method: "POST" });
    const data = await res.json();
    setRecoveryCodes(data.codes);
    setStep("recovery");
  }

  function handleFinish() {
    router.push("/");
    router.refresh();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center w-80">
        <span className="font-serif text-6xl text-foreground select-none mb-4">
          δ
        </span>
        {error && <div className="text-sm text-destructive mb-4">{error}</div>}

        {step === "choose" && (
          <div className="flex flex-col gap-3 w-full">
            <Button
              variant="outline"
              onClick={() => setStep("passkey")}
              className="w-full"
            >
              passkey / hardware key
            </Button>
            <Button
              variant="outline"
              onClick={handleTotpStart}
              disabled={loading}
              className="w-full"
            >
              authenticator app
            </Button>
          </div>
        )}

        {step === "passkey" && (
          <div className="flex flex-col gap-3 w-full">
            <Input
              value={passkeyName}
              onChange={(e) => setPasskeyName(e.target.value)}
              placeholder="key name (e.g. yubikey)"
              autoFocus
            />
            <Button
              onClick={handlePasskeySetup}
              disabled={loading}
              className="w-full"
            >
              {loading ? "..." : "register passkey"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep("choose")}
              className="w-full"
            >
              back
            </Button>
          </div>
        )}

        {step === "totp-qr" && (
          <div className="flex flex-col gap-3 w-full items-center">
            {qrCode && (
              <img src={qrCode} alt="TOTP QR code" className="w-48 h-48" />
            )}
            <code className="text-xs text-muted-foreground break-all select-all px-2">
              {totpSecret}
            </code>
            <Button onClick={() => setStep("totp-verify")} className="w-full">
              next
            </Button>
          </div>
        )}

        {step === "totp-verify" && (
          <div className="flex flex-col gap-3 w-full">
            <Input
              value={totpToken}
              onChange={(e) => setTotpToken(e.target.value)}
              placeholder="6-digit code"
              autoFocus
              maxLength={6}
            />
            <Button
              onClick={handleTotpVerify}
              disabled={loading || totpToken.length !== 6}
              className="w-full"
            >
              {loading ? "..." : "verify"}
            </Button>
          </div>
        )}

        {step === "recovery" && (
          <div className="flex flex-col gap-3 w-full">
            <div className="border border-border p-3 font-mono text-sm leading-relaxed select-all text-center">
              {recoveryCodes.map((code) => (
                <div key={code}>{code}</div>
              ))}
            </div>
            <Button onClick={handleFinish} className="w-full">
              continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
