import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerAuth } from "./auth.js";
import { registerCatCommand } from "./cat.js";
import { registerCompletionCommands } from "./completion.js";
import { registerConfigCommands } from "./config-cmd.js";
import { registerCronCommands } from "./cron.js";
import { registerExportCommand } from "./export.js";
import { registerFeedCommands } from "./feed.js";
import { registerHelp } from "./help.js";
import { registerImportCommand } from "./import.js";
import { registerIntegrationCommands } from "./integration.js";
import { registerInviteCommands } from "./invite.js";
import { setDebug } from "./lib/client.js";
import { configure } from "./lib/output.js";
import { registerShareCommand } from "./share.js";
import { registerSyncCommand } from "./sync.js";
import { registerTaskCommands } from "./task.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
) as {
  version: string;
};

const program = new Command();

program
  .name("delta")
  .version(pkg.version)
  .description("CLI client for the delta productivity platform")
  .option(
    "--json [fields]",
    "JSON output (optional comma-separated field list)",
  )
  .option("--jq <expr>", "Filter JSON output (implies --json)")
  .option("-q, --quiet", "IDs only or nothing on success")
  .option("--no-color", "Disable color output")
  .option("--server <url>", "Override server URL")
  .option("--debug", "Print HTTP requests and responses to stderr")
  .hook("preAction", (_thisCommand, actionCommand) => {
    const opts = actionCommand.optsWithGlobals();
    configure({
      color: opts.color,
      json: opts.json,
      quiet: opts.quiet,
      jq: opts.jq,
    });
    if (opts.debug) {
      setDebug(true);
    }
  });

const task = new Command("task").description("Task CRUD and status changes");
registerTaskCommands(task);

const cat = new Command("cat").description("List categories with task counts");
registerCatCommand(cat);

const cron = new Command("cron").description("Automation management");
registerCronCommands(cron);

registerAuth(program);
registerSyncCommand(program);
registerFeedCommands(program);
registerImportCommand(program);
registerExportCommand(program);

const invite = new Command("invite").description("Invite link management");
registerInviteCommands(invite);

const share = new Command("share").description(
  "Generate share link for a task",
);
registerShareCommand(share);

const config = new Command("config").description("Settings management");
registerConfigCommands(config);

const integration = new Command("integration").description(
  "Integration management",
);
registerIntegrationCommands(integration);

program.addCommand(task);
program.addCommand(cat);
program.addCommand(cron);
program.addCommand(invite);
program.addCommand(share);
program.addCommand(config);
program.addCommand(integration);
registerHelp(program);
registerCompletionCommands(program);

program.action(() => {
  task.commands.find((c) => c.name() === "list")?.parse(process.argv);
});

program.parse();
