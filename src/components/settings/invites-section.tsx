"use client";

import { useCallback, useEffect, useState } from "react";
import {
  generateInviteAction,
  type InviteLinkRow,
  listInvitesAction,
} from "@/app/actions/invites";
import { useStatusBar } from "@/contexts/status-bar";
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "./settings-primitives";

export function InvitesSection() {
  const statusBar = useStatusBar();
  const [invites, setInvites] = useState<InviteLinkRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadInvites = useCallback(async () => {
    const result = await listInvitesAction();
    if ("data" in result) {
      setInvites(result.data);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  function getInviteUrl(token: string): string {
    return `${window.location.origin}/invite/${token}`;
  }

  async function handleGenerate() {
    const result = await generateInviteAction();
    if ("error" in result) {
      statusBar.error(result.error);
      return;
    }
    statusBar.message("invite link generated");
    await loadInvites();
  }

  async function handleCopy(token: string) {
    await navigator.clipboard.writeText(getInviteUrl(token));
    statusBar.message("copied to clipboard");
  }

  const active =
    loaded && invites.length > 0
      ? invites.find((inv) => {
          const expired = new Date(inv.expiresAt) < new Date();
          const exhausted = inv.useCount >= inv.maxUses;
          return !expired && !exhausted;
        })
      : null;

  return (
    <SettingsPage
      title="invites"
      description="Create and share invite links for new sign-ins."
    >
      <SettingsSection
        title="invite links"
        description="Generate a reusable link and copy the current active invite."
      >
        {active ? (
          <>
            <SettingsRow
              label="copy invite link"
              value={`${active.useCount}/${active.maxUses} uses`}
              action
              onClick={() => handleCopy(active.token)}
            />
            <SettingsRow
              label="+ generate new"
              action
              muted
              onClick={handleGenerate}
            />
          </>
        ) : (
          <SettingsRow
            label="+ generate invite link"
            action
            muted
            onClick={handleGenerate}
          />
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
