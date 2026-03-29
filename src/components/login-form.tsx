"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Provider = "github" | "google" | "gitlab";

const ERROR_MESSAGES: Record<string, string> = {
  no_invite: "an invite link is required to create an account",
  invalid_invite: "invalid or expired invite link",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const urlError = searchParams.get("error");
  const urlErrorMessage = urlError ? ERROR_MESSAGES[urlError] : null;

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

  const hasProviders = providers.length > 0;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center">
        <span className="font-serif text-6xl text-foreground select-none mb-8">
          δ
        </span>
        <div className="flex flex-col gap-3 w-64">
          {urlErrorMessage && (
            <p className="text-sm text-destructive text-center">
              {urlErrorMessage}
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {!expanded ? (
            <Button
              variant="outline"
              onClick={() => (hasProviders ? setExpanded(true) : handlePasskey())}
              disabled={loading}
              className="w-full"
            >
              {loading ? "..." : "sign in"}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              {providers.includes("github") && (
                <Button
                  variant="ghost"
                  onClick={() => handleOAuth("github")}
                  disabled={loading}
                  className="w-full justify-start"
                >
                  github
                </Button>
              )}
              {providers.includes("google") && (
                <Button
                  variant="ghost"
                  onClick={() => handleOAuth("google")}
                  disabled={loading}
                  className="w-full justify-start"
                >
                  google
                </Button>
              )}
              {providers.includes("gitlab") && (
                <Button
                  variant="ghost"
                  onClick={() => handleOAuth("gitlab")}
                  disabled={loading}
                  className="w-full justify-start"
                >
                  gitlab
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={handlePasskey}
                disabled={loading}
                className="w-full justify-start"
              >
                {loading ? "..." : "passkey"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
