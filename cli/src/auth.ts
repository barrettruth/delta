import { createInterface } from "node:readline";
import { Command } from "commander";
import {
  createClient,
  DeltaClient,
  DeltaClientError,
  getServerUrl,
} from "./lib/client.js";
import { clearToken, getToken, setToken } from "./lib/keyring.js";

interface MeResponse {
  user: {
    id: number;
    username: string;
  };
}

interface RegenerateResponse {
  token: string;
}

function getTokenSource(): "env" | "file" | null {
  if (process.env.DELTA_TOKEN) return "env";
  if (getToken()) return "file";
  return null;
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function validateToken(token: string): Promise<MeResponse> {
  const client = new DeltaClient(getServerUrl(), token);
  return client.get<MeResponse>("/api/auth/me");
}

async function handleLogin(opts: { token?: boolean }): Promise<void> {
  const isTTY = process.stdin.isTTY;

  if (!opts.token && isTTY) {
    process.stderr.write(
      "Device flow is not yet available. Falling back to token paste.\n",
    );
  }

  let token: string;

  if (isTTY) {
    token = await prompt("Paste API token: ");
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
    token = Buffer.concat(chunks).toString("utf-8").trim();
  }

  if (!token) {
    process.stderr.write("No token provided.\n");
    process.exit(2);
  }

  try {
    const result = await validateToken(token);
    setToken(token);
    process.stdout.write(`Logged in as ${result.user.username}\n`);
  } catch (e) {
    if (e instanceof DeltaClientError && e.status === 401) {
      process.stderr.write("Invalid token.\n");
      process.exit(4);
    }
    throw e;
  }
}

function handleLogout(): void {
  clearToken();
  process.stdout.write("Logged out\n");
}

async function handleStatus(): Promise<void> {
  const token = getToken();

  if (!token) {
    process.stderr.write("Not authenticated\n");
    process.exit(4);
  }

  const source = getTokenSource();

  try {
    const result = await validateToken(token);
    const sourceLabel = source === "env" ? "env var" : "credentials file";
    process.stdout.write(
      `Authenticated as ${result.user.username} (${sourceLabel})\n`,
    );
  } catch (e) {
    if (e instanceof DeltaClientError && e.status === 401) {
      process.stderr.write("Token is invalid or expired.\n");
      process.exit(4);
    }
    throw e;
  }
}

function handleToken(opts: { unmask?: boolean }): void {
  const token = getToken();

  if (!token) {
    process.stderr.write("No token stored.\n");
    process.exit(4);
  }

  if (opts.unmask) {
    process.stdout.write(`${token}\n`);
  } else {
    const masked =
      token.length > 8
        ? `${token.slice(0, 4)}${"*".repeat(token.length - 8)}${token.slice(-4)}`
        : "*".repeat(token.length);
    process.stdout.write(`${masked}\n`);
  }
}

async function handleTokenRegenerate(): Promise<void> {
  const client = createClient();

  try {
    const result = await client.post<RegenerateResponse>(
      "/api/auth/token/regenerate",
    );
    setToken(result.token);
    process.stdout.write(`${result.token}\n`);
  } catch (e) {
    if (e instanceof DeltaClientError && e.status === 404) {
      process.stderr.write(
        "Token regeneration endpoint not available on this server.\n",
      );
      process.exit(1);
    }
    throw e;
  }
}

export function registerAuth(program: Command): Command {
  const auth = new Command("auth").description("Authentication");

  auth
    .command("login")
    .description("Authenticate with the server")
    .option("--token", "Paste API token (headless/CI)")
    .action(async (opts: { token?: boolean }) => {
      await handleLogin(opts);
    });

  auth
    .command("logout")
    .description("Clear stored credentials")
    .action(() => {
      handleLogout();
    });

  auth
    .command("status")
    .description("Show current user and auth method")
    .action(async () => {
      await handleStatus();
    });

  const token = auth
    .command("token")
    .description("Display or manage API token")
    .option("--unmask", "Show full token without masking")
    .action((opts: { unmask?: boolean }) => {
      handleToken(opts);
    });

  token
    .command("regenerate")
    .description("Regenerate API token")
    .action(async () => {
      await handleTokenRegenerate();
    });

  program.addCommand(auth);
  return auth;
}
