"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isSignUp ? "/api/auth/register" : "/api/auth/login";
    const body = isSignUp
      ? { username, password, inviteCode }
      : { username, password };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json();
      if (data.error === "User not found") {
        setIsSignUp(true);
        setError("");
      } else {
        setError(data.error ?? "Login failed");
      }
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
        </form>
      </div>
    </div>
  );
}
