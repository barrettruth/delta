"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div className="w-full max-w-xs rounded-lg border border-border/60 bg-card p-8 shadow-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <h1 className="text-5xl text-center text-foreground select-none font-serif">
            &Delta;
          </h1>
          <p className="text-sm text-muted-foreground text-center -mt-2">
            Sign in
          </p>
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive text-center">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? "Signing in\u2026" : "Sign in"}
          </Button>
        </form>
        {availableProviders.length > 0 && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-border/60" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border/60" />
            </div>
            <div className="flex flex-col gap-2">
              {availableProviders.map((provider) => (
                <Button
                  key={provider}
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    window.location.href = `/api/auth/${provider}`;
                  }}
                >
                  Continue with {providerLabels[provider]}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
