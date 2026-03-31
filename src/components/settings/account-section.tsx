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

interface ConnectedAccount {
  id: number;
  provider: string;
  providerAccountId: string;
  email: string | null;
  name: string | null;
  createdAt: string;
}

export function AccountSection({
  username: initialUsername,
  connectedAccounts: initialAccounts,
}: {
  username: string;
  connectedAccounts: ConnectedAccount[];
}) {
  const router = useRouter();
  const statusBar = useStatusBar();
  const [username, setUsername] = useState(initialUsername);
  const [editing, setEditing] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState(initialAccounts);

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

  async function handleUnlinkProvider(provider: string) {
    const res = await fetch(`/api/auth/unlink/${provider}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      statusBar.error(data.error ?? "failed to unlink provider");
      return;
    }
    setConnectedAccounts((prev) => prev.filter((a) => a.provider !== provider));
    statusBar.message(`${provider} unlinked`);
  }

  return (
    <SettingsPage>
      <SettingsSection title="account">
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

      <SettingsSection title="connected accounts">
        {connectedAccounts.map((account) => (
          <SettingsRow
            key={account.id}
            label={`- ${account.provider}`}
            value={account.name ?? account.email ?? account.providerAccountId}
            action
            destructive
            onClick={() => handleUnlinkProvider(account.provider)}
          />
        ))}
        {connectedAccounts.length === 0 && (
          <SettingsRow label="no accounts linked" muted />
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
