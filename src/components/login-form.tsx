"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Step = "credentials" | "totp";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [twoFactorMethods, setTwoFactorMethods] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (step === "totp") {
      await handleTotpVerify();
      setLoading(false);
      return;
    }

    const endpoint = isSignUp ? "/api/auth/register" : "/api/auth/login";
    const body = isSignUp
      ? { username, password, inviteCode }
      : { username, password };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.ok) {
      if (data.requires2FA) {
        setTwoFactorMethods(data.methods);
        if (data.methods.includes("webauthn")) {
          await handleWebAuthnLogin();
        } else {
          setStep("totp");
        }
      } else {
        router.push("/");
        router.refresh();
      }
    } else {
      setError(data.error ?? "Login failed");
    }
    setLoading(false);
  }

  async function handleTotpVerify() {
    const res = await fetch("/api/auth/totp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: totpToken }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Verification failed");
    }
  }

  async function handleWebAuthnLogin() {
    try {
      const optionsRes = await fetch("/api/auth/webauthn/authenticate");
      const options = await optionsRes.json();
      const authentication = await startAuthentication({
        optionsJSON: options,
      });

      const res = await fetch("/api/auth/webauthn/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authentication),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        if (twoFactorMethods.includes("totp")) {
          setStep("totp");
          setError("passkey failed, enter totp code instead");
        } else {
          setError("Authentication failed");
        }
      }
    } catch {
      if (twoFactorMethods.includes("totp")) {
        setStep("totp");
      } else {
        setError("Passkey authentication failed");
      }
    }
  }

  async function handlePasskeyOnly() {
    setError("");
    setLoading(true);
    try {
      const optionsRes = await fetch("/api/auth/webauthn/authenticate");
      const options = await optionsRes.json();
      const authentication = await startAuthentication({
        optionsJSON: options,
      });

      const res = await fetch("/api/auth/webauthn/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authentication),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Authentication failed");
      }
    } catch {
      setError("Passkey authentication cancelled");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center">
        <span className="font-serif text-6xl text-foreground select-none mb-8">
          δ
        </span>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-64">
          {error && <div className="text-sm text-destructive">{error}</div>}

          {step === "credentials" && (
            <>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                autoFocus
                autoComplete="username"
              />
              <Input
                type="text"
                value={"*".repeat(password.length)}
                onChange={() => {}}
                onKeyDown={(e) => {
                  if (e.key === "Backspace") {
                    e.preventDefault();
                    setPassword((p) => p.slice(0, -1));
                  } else if (e.key === "Enter") {
                  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    setPassword((p) => p + e.key);
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text");
                  setPassword((p) => p + pasted);
                }}
                placeholder="password"
                autoComplete="off"
                spellCheck={false}
              />
              {isSignUp && (
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="invite code"
                  autoComplete="off"
                />
              )}
              <Button type="submit" disabled={loading}>
                {loading ? "..." : isSignUp ? "sign up" : "login"}
              </Button>
            </>
          )}

          {step === "totp" && (
            <>
              <p className="text-sm text-muted-foreground">
                enter authenticator code or recovery code
              </p>
              <Input
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value)}
                placeholder="6-digit code or recovery code"
                autoFocus
                autoComplete="off"
              />
              <Button type="submit" disabled={loading}>
                {loading ? "..." : "verify"}
              </Button>
            </>
          )}

          {step === "credentials" && (
            <>
              {!isSignUp && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePasskeyOnly}
                  disabled={loading}
                >
                  sign in with passkey
                </Button>
              )}
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setIsSignUp((v) => !v);
                  setError("");
                }}
              >
                {isSignUp
                  ? "already have an account? login"
                  : "don't have an account? sign up"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
