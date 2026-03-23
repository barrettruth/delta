"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
      </div>
    </div>
  );
}
