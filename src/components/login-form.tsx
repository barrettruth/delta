"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OAuthProvider } from "@/core/oauth";

const errorMessages: Record<string, string> = {
  invite_required: "invite code required for new accounts",
  invalid_invite: "invalid or already used invite code",
  invalid_state: "authentication failed, please try again",
  token_exchange_failed: "authentication failed, please try again",
  oauth_failed: "authentication failed, please try again",
};

const providerButtons: Record<
  OAuthProvider,
  { label: string; icon: React.ReactNode }
> = {
  github: {
    label: "github",
    icon: (
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 fill-current"
        aria-hidden="true"
      >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
    ),
  },
  gitlab: {
    label: "gitlab",
    icon: null,
  },
};

export function LoginForm({
  availableProviders,
}: {
  availableProviders: OAuthProvider[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState(
    oauthError ? (errorMessages[oauthError] ?? oauthError) : "",
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Login failed");
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
          <Input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="invite code"
            autoComplete="off"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "login"}
          </Button>
          {availableProviders.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {availableProviders.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  className="flex items-center justify-center gap-2 h-9 w-full border border-border text-sm text-foreground hover:bg-accent"
                  onClick={() => {
                    const params = inviteCode
                      ? `?invite=${encodeURIComponent(inviteCode)}`
                      : "";
                    window.location.href = `/api/auth/${provider}${params}`;
                  }}
                >
                  {providerButtons[provider].icon}
                  {providerButtons[provider].label}
                </button>
              ))}
            </>
          )}
        </form>
      </div>
    </div>
  );
}
