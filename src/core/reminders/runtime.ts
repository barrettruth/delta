import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getSystemConfig } from "@/core/system-config";
import type { Task } from "@/core/types";
import type { Db } from "../types";
import type { ReminderEndpointRecord } from "./endpoints";
import type {
  ReminderAdapterKey,
  ReminderDelivery,
  TaskReminder,
} from "./types";

export class ReminderAdapterError extends Error {
  retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = "ReminderAdapterError";
    this.retryable = retryable;
  }
}

export interface ReminderAdapterSendInput {
  db: Db;
  endpoint: ReminderEndpointRecord;
  body: string;
  delivery?: ReminderDelivery;
  reminder?: TaskReminder;
  task?: Task;
}

export interface ReminderAdapterSendResult {
  providerMessageId?: string | null;
}

export interface ReminderAdapterRuntime {
  key: ReminderAdapterKey;
  send: (
    input: ReminderAdapterSendInput,
  ) => Promise<ReminderAdapterSendResult | undefined>;
}

const runtimes = new Map<ReminderAdapterKey, ReminderAdapterRuntime>();
const execFileAsync = promisify(execFile);

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function throwForHttpFailure(response: Response): Promise<never> {
  throw new ReminderAdapterError(
    `unexpected error (${response.status})`,
    isRetryableStatus(response.status),
  );
}

function requireSystemConfig(db: Db, key: string, label: string): string {
  const value = getSystemConfig(db, key);
  if (!value) {
    throw new ReminderAdapterError(`${label} is not configured`);
  }
  return value;
}

function requireSignalSystemConfig(db: Db, key: string, label: string): string {
  const value = getSystemConfig(db, key);
  if (!value) {
    throw new ReminderAdapterError(`${label} is not configured`, false);
  }
  return value;
}

function getSignalCliErrorMessage(
  error: Error & {
    code?: string | number;
    stderr?: string;
    stdout?: string;
  },
): string {
  if (typeof error.stderr === "string" && error.stderr.trim()) {
    return error.stderr.trim();
  }
  if (typeof error.stdout === "string" && error.stdout.trim()) {
    return error.stdout.trim();
  }
  if (error.message.trim()) {
    return error.message.trim();
  }
  if (error.code !== undefined) {
    return `signal-cli exited with code ${error.code}`;
  }
  return "signal-cli send failed";
}

async function sendSlackWebhook(
  input: ReminderAdapterSendInput,
): Promise<ReminderAdapterSendResult> {
  const response = await fetch(input.endpoint.target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: input.body }),
  });

  if (!response.ok) {
    await throwForHttpFailure(response);
  }

  return { providerMessageId: null };
}

async function sendDiscordWebhook(
  input: ReminderAdapterSendInput,
): Promise<ReminderAdapterSendResult> {
  const response = await fetch(input.endpoint.target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: input.body }),
  });

  if (!response.ok) {
    await throwForHttpFailure(response);
  }

  let providerMessageId: string | null = null;
  if (response.status !== 204) {
    try {
      const body = (await response.json()) as { id?: string };
      providerMessageId = body.id ?? null;
    } catch {}
  }

  return { providerMessageId };
}

async function sendTelegramMessage(
  input: ReminderAdapterSendInput,
): Promise<ReminderAdapterSendResult> {
  const botToken = requireSystemConfig(
    input.db,
    "reminders.telegram.bot_api.bot_token",
    "Telegram bot token",
  );

  const response = await fetch(
    `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: input.endpoint.target,
        text: input.body,
      }),
    },
  );

  if (!response.ok) {
    await throwForHttpFailure(response);
  }

  const body = (await response.json()) as {
    ok?: boolean;
    result?: { message_id?: number };
  };

  if (!body.ok) {
    throw new ReminderAdapterError("unexpected error (200)", false);
  }

  return {
    providerMessageId:
      body.result?.message_id !== undefined
        ? String(body.result.message_id)
        : null,
  };
}

async function sendTwilioSms(
  input: ReminderAdapterSendInput,
): Promise<ReminderAdapterSendResult> {
  const accountSid = requireSystemConfig(
    input.db,
    "reminders.sms.twilio.account_sid",
    "Twilio account SID",
  );
  const authToken = requireSystemConfig(
    input.db,
    "reminders.sms.twilio.auth_token",
    "Twilio auth token",
  );
  const fromNumber = requireSystemConfig(
    input.db,
    "reminders.sms.twilio.from_number",
    "Twilio from number",
  );

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: input.endpoint.target,
        From: fromNumber,
        Body: input.body,
      }),
    },
  );

  if (!response.ok) {
    await throwForHttpFailure(response);
  }

  const body = (await response.json()) as { sid?: string };
  return {
    providerMessageId: body.sid ?? null,
  };
}

async function sendSignalMessage(
  input: ReminderAdapterSendInput,
): Promise<ReminderAdapterSendResult> {
  const account = requireSignalSystemConfig(
    input.db,
    "reminders.signal.signal_cli.account",
    "Signal account",
  );
  const configPath = requireSignalSystemConfig(
    input.db,
    "reminders.signal.signal_cli.config_path",
    "Signal config path",
  );

  try {
    await execFileAsync(
      "signal-cli",
      [
        "--config",
        configPath,
        "-a",
        account,
        "send",
        "-m",
        input.body,
        input.endpoint.target,
      ],
      { timeout: 30_000 },
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      throw new ReminderAdapterError("signal-cli is not installed", false);
    }

    if (error instanceof Error) {
      throw new ReminderAdapterError(
        getSignalCliErrorMessage(
          error as Error & {
            code?: string | number;
            stderr?: string;
            stdout?: string;
          },
        ),
      );
    }

    throw new ReminderAdapterError("signal-cli send failed");
  }

  return { providerMessageId: null };
}

function registerBuiltinReminderAdapterRuntimes() {
  if (runtimes.size > 0) return;

  runtimes.set("slack.webhook", {
    key: "slack.webhook",
    send: sendSlackWebhook,
  });
  runtimes.set("discord.webhook", {
    key: "discord.webhook",
    send: sendDiscordWebhook,
  });
  runtimes.set("telegram.bot_api", {
    key: "telegram.bot_api",
    send: sendTelegramMessage,
  });
  runtimes.set("sms.twilio", {
    key: "sms.twilio",
    send: sendTwilioSms,
  });
  runtimes.set("signal.signal_cli", {
    key: "signal.signal_cli",
    send: sendSignalMessage,
  });
}

export function getReminderAdapterRuntime(
  key: ReminderAdapterKey,
): ReminderAdapterRuntime | null {
  registerBuiltinReminderAdapterRuntimes();
  return runtimes.get(key) ?? null;
}
