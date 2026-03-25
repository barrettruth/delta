"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OAuthProvider } from "@/core/oauth";

const providerLabels: Record<OAuthProvider, string> = {
  github: "GitHub",
  google: "Google",
  gitlab: "GitLab",
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
  const [error, setError] = useState(oauthError ?? "");
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
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          autoComplete="current-password"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "..." : "login"}
        </Button>
        {availableProviders.map((provider) => (
          <Button
            key={provider}
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              window.location.href = `/api/auth/${provider}`;
            }}
          >
            {providerLabels[provider]}
          </Button>
        ))}
      </form>
    </div>
  );
}
