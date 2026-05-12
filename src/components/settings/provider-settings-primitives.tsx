"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsRow } from "./settings-primitives";

export interface ProviderSettingsOption<ProviderId extends string> {
  id: ProviderId;
  label: string;
}

export function useProviderKeyEditor<ProviderId extends string>() {
  const [input, setInput] = useState("");
  const [target, setTarget] = useState<ProviderId | null>(null);
  const [testing, setTesting] = useState(false);

  const open = useCallback((provider: ProviderId) => {
    setTarget(provider);
    setInput("");
  }, []);

  const close = useCallback(() => {
    setTarget(null);
    setInput("");
  }, []);

  return {
    close,
    input,
    open,
    setInput,
    setTesting,
    target,
    testing,
  };
}

export async function testSettingsProviderApiKey(
  provider: string,
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  const res = await fetch("/api/settings/integrations/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, apiKey }),
  });
  return res.json();
}

export function ProviderSettingsList<ProviderId extends string>({
  activeProvider,
  inputType = "text",
  keyInput,
  keyTarget,
  keyTesting,
  onCancelKeyInput,
  onKeyInputChange,
  onProviderSelect,
  onTestKey,
  providers,
}: {
  activeProvider: ProviderId;
  inputType?: "password" | "text";
  keyInput: string;
  keyTarget: ProviderId | null;
  keyTesting: boolean;
  onCancelKeyInput: () => void;
  onKeyInputChange: (value: string) => void;
  onProviderSelect: (provider: ProviderId) => void;
  onTestKey: () => void;
  providers: readonly ProviderSettingsOption<ProviderId>[];
}) {
  return (
    <>
      {providers.map((provider) => (
        <div key={provider.id}>
          <SettingsRow
            label={provider.label}
            value={activeProvider === provider.id ? "active" : ""}
            action
            muted={activeProvider !== provider.id}
            onClick={() => onProviderSelect(provider.id)}
          />
          {keyTarget === provider.id && (
            <div className="flex gap-2 px-2 py-1">
              <Input
                value={keyInput}
                onChange={(event) => onKeyInputChange(event.target.value)}
                placeholder="api key"
                type={inputType}
                autoFocus
                className="h-8 flex-1 text-sm"
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") onTestKey();
                  if (event.key === "Escape") onCancelKeyInput();
                }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={keyTesting || !keyInput.trim()}
                onClick={onTestKey}
                className="h-8 text-sm"
              >
                {keyTesting ? "..." : "test & save"}
              </Button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
