"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Provider = "github" | "google" | "gitlab";

const ERROR_MESSAGES: Record<string, string> = {
  no_invite: "an invite link is required to create an account",
  invalid_invite: "invalid or expired invite link",
};

interface LoginOption {
  id: string;
  label: string;
  action: () => void;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);

  const urlError = searchParams.get("error");
  const urlErrorMessage = urlError ? ERROR_MESSAGES[urlError] : null;

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((res) => res.json())
      .then((data) => setProviders(data.providers ?? []))
      .catch(() => {});
  }, []);

  const handleOAuth = useCallback((provider: Provider) => {
    window.location.href = `/api/auth/${provider}`;
  }, []);

  const handlePasskey = useCallback(async () => {
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
        setError("authentication failed");
      }
    } catch {
      setError("passkey authentication cancelled");
    }
    setLoading(false);
  }, [router]);

  const options: LoginOption[] = useMemo(
    () => [
      { id: "passkey", label: "passkey", action: handlePasskey },
      ...providers.map((p) => ({
        id: p,
        label: p,
        action: () => handleOAuth(p),
      })),
    ],
    [handlePasskey, handleOAuth, providers],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (loading) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, options.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        options[selected]?.action();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [options, selected, loading]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center">
        <span className="font-serif text-6xl text-foreground select-none mb-8">
          δ
        </span>
        <div className="flex flex-col w-64">
          {urlErrorMessage && (
            <p className="text-sm text-destructive text-center mb-3">
              {urlErrorMessage}
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive text-center mb-3">{error}</p>
          )}
          {options.map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              className={`w-full text-left text-sm py-3 md:py-1.5 px-3 transition-colors ${selected === i ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
              onClick={opt.action}
              onMouseEnter={() => setSelected(i)}
              disabled={loading}
            >
              {loading && selected === i ? "..." : opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
