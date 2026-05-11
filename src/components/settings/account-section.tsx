"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useStatusBar } from "@/contexts/status-bar";
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "./settings-primitives";

export function AccountSection({
  username: initialUsername,
  apiKey: initialApiKey,
}: {
  username: string;
  apiKey: string | null;
}) {
  const router = useRouter();
  const statusBar = useStatusBar();
  const [username, setUsername] = useState(initialUsername);
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState(initialApiKey);

  async function handleSaveUsername() {
    const trimmed = username.trim();
    if (!trimmed || trimmed === initialUsername) {
      setEditing(false);
      return;
    }
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: trimmed }),
    });
    if (!res.ok) {
      const data = await res.json();
      statusBar.error(data.error ?? "failed to update username");
      setUsername(initialUsername);
    } else {
      statusBar.message("username updated");
      router.refresh();
    }
    setEditing(false);
  }

  async function handleCopyApiKey() {
    if (!apiKey) {
      statusBar.error("api key is not set");
      return;
    }
    await navigator.clipboard.writeText(apiKey);
    statusBar.message("api key copied");
  }

  async function handleRegenerateApiKey() {
    const res = await fetch("/api/auth/token/regenerate", { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      statusBar.error(data.error ?? "failed to regenerate api key");
      return;
    }
    const data = await res.json();
    setApiKey(data.apiKey);
    statusBar.message("api key regenerated");
  }

  return (
    <SettingsPage
      title="account"
      description="Manage your local self-hosted profile and API access."
    >
      <SettingsSection
        title="profile"
        description="Update the username shown throughout delta."
      >
        {editing ? (
          <div className="flex gap-2 px-2">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              className="h-7 text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveUsername();
                if (e.key === "Escape") {
                  setUsername(initialUsername);
                  setEditing(false);
                }
              }}
              onBlur={handleSaveUsername}
            />
          </div>
        ) : (
          <SettingsRow
            label="username"
            value={username}
            action
            onClick={() => setEditing(true)}
          />
        )}
      </SettingsSection>

      <SettingsSection
        title="API access"
        description="Use this key for scripts and CLI clients."
      >
        <SettingsRow
          label="copy API key"
          value={apiKey ? `${apiKey.slice(0, 8)}...` : "not set"}
          action
          onClick={handleCopyApiKey}
        />
        <SettingsRow
          label="regenerate API key"
          action
          muted
          onClick={handleRegenerateApiKey}
        />
      </SettingsSection>
    </SettingsPage>
  );
}
