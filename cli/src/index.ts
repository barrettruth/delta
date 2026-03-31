import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerHelp } from "./help.js";
import { setDebug } from "./lib/client.js";
import { configure } from "./lib/output.js";
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

const cron = new Command("cron").description("Automation management");
cron.command("list").description("List automations");
cron.command("add").description("Create automation");
cron.command("edit").description("Update automation");
cron.command("delete").description("Delete automation");
cron.command("run").description("Trigger automation manually");
cron.command("enable").description("Enable automation");
cron.command("disable").description("Disable automation");
cron.action(() => {
  cron.commands.find((c) => c.name() === "list")?.parse(process.argv);
});

const auth = new Command("auth").description("Authentication");
auth.command("login").description("Authenticate with the server");
auth.command("logout").description("Clear stored credentials");
auth.command("status").description("Show current user and auth method");
auth.command("token").description("Display or manage API token");

const sync = new Command("sync").description("Trigger Google Calendar sync");

const feed = new Command("feed").description("iCal feed management");
feed.command("generate").description("Generate/regenerate feed URL");
feed.command("revoke").description("Revoke feed URL");
feed.action(() => {
  process.stdout.write("Feed status\n");
});

const imp = new Command("import").description(
  "Import from iCal or other sources",
);

const exp = new Command("export").description("Export as iCal");

const invite = new Command("invite").description("Invite link management");
invite.command("list").description("List invite links");
invite.command("create").description("Generate invite link");
invite.action(() => {
  invite.commands.find((c) => c.name() === "list")?.parse(process.argv);
});

const share = new Command("share").description(
  "Generate share link for a task",
);

const config = new Command("config").description("Settings management");
config.command("get").description("Get a setting value");
config.command("set").description("Set a setting value");
config.action(() => {
  process.stdout.write("Config\n");
});

const integration = new Command("integration").description(
  "Integration management",
);
integration.command("list").description("List configured integrations");
integration.command("test").description("Test integration API key");
integration.action(() => {
  integration.commands.find((c) => c.name() === "list")?.parse(process.argv);
});

const completion = new Command("completion").description(
  "Shell completion generation",
);
completion.command("bash").description("Output bash completions");
completion.command("zsh").description("Output zsh completions");
completion.command("fish").description("Output fish completions");

program.addCommand(task);
program.addCommand(cat);
program.addCommand(cron);
program.addCommand(auth);
program.addCommand(sync);
program.addCommand(feed);
program.addCommand(imp);
program.addCommand(exp);
program.addCommand(invite);
program.addCommand(share);
program.addCommand(config);
program.addCommand(integration);
registerHelp(program);
program.addCommand(completion);

program.action(() => {
  task.commands.find((c) => c.name() === "list")?.parse(process.argv);
});

program.parse();
