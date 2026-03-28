"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Provider = "github" | "google";

export function LoginForm() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((res) => res.json())
      .then((data) => setProviders(data.providers ?? []))
      .catch(() => {});
  }, []);

  function handleOAuth(provider: Provider) {
    window.location.href = `/api/auth/${provider}`;
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
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center">
        <span className="font-serif text-6xl text-foreground select-none mb-8">
          δ
        </span>
        <div className="flex flex-col gap-3 w-64">
          {error && <div className="text-sm text-destructive">{error}</div>}

          {providers.includes("github") && (
            <Button
              variant="outline"
              onClick={() => handleOAuth("github")}
              disabled={loading}
              className="w-full"
            >
              sign in with github
            </Button>
          )}

          {providers.includes("google") && (
            <Button
              variant="outline"
              onClick={() => handleOAuth("google")}
              disabled={loading}
              className="w-full"
            >
              sign in with google
            </Button>
          )}

          <Button
            variant="outline"
            onClick={handlePasskey}
            disabled={loading}
            className="w-full"
          >
            {loading
              ? "..."
              : providers.length > 0
                ? "sign in with passkey"
                : "sign in"}
          </Button>
        </div>
      </div>
    </div>
  );
}
