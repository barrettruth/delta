import { execSync } from "node:child_process";
import { Command } from "commander";

function overview(): string {
  return `delta - CLI client for the delta productivity platform

Usage: delta <command> [args] [--flags] [filters]

Commands:
  task [list|add|edit|done|delete|wip|block|pending|dep]
  cat                        List categories with task counts
  cron [list|add|edit|delete|run|enable|disable]
  auth [login|logout|status|token]
  sync                       Trigger Google Calendar sync
  feed [generate|revoke]     iCal feed management
  import <file>              Import iCal file
  export                     Export as iCal to stdout
  config [get|set]           Settings management
  integration [list|test]    Integration management
  invite [list|create]       Invite link management
  share <id>                 Generate share link for a task
  completion [bash|zsh|fish] Shell completion scripts
  help [topic]               Built-in help topics

Universal flags:
  --json [fields]   JSON output (optional field list)
  --jq <expr>       Filter JSON (implies --json)
  -q, --quiet       IDs only / silent success
  --no-color        Disable color (also: NO_COLOR env)
  --server <url>    Override server URL
  --debug           Print HTTP traffic to stderr
  -y, --yes         Skip confirmation prompts

Bare 'delta' is equivalent to 'delta task list'.

Run 'delta help <topic>' for detailed help:
  filters    Filter syntax reference
  dates      Date format reference
  auth       Authentication setup
  examples   Workflow recipes`;
}

function filters(): string {
  return `Filter Syntax

Filters are key:value pairs passed as positional args to list commands.
Date keys support .before and .after modifiers.

  status:pending         Exact status match (pending|wip|done|blocked|cancelled)
  category:work          Exact category match
  priority:2             Exact priority match
  due.before:friday      Due before a date
  due.after:today        Due after a date
  created.before:2026-01-01
  updated.after:yesterday
  sort:urgency           Sort field (urgency|due|created|priority)
  limit:20               Max results

Date range shorthand (on startAt):
  --from monday --until friday

Combine freely:
  delta task list category:work priority:2 due.before:eow sort:due`;
}

function dates(): string {
  return `Date Formats

Relative:
  today, tomorrow, yesterday
  monday .. sunday          Next occurrence of that day
  eow                       End of week
  eom                       End of month
  next week, next month

Offsets:
  +3d                       3 days from now
  +1w                       1 week from now
  +2m                       2 months from now

ISO 8601:
  2026-04-01                Date
  2026-04-01T09:00:00       Datetime

All --due, --start, --end, --from, --until flags and date filter
values accept these formats.`;
}

function authHelp(): string {
  return `Authentication Setup

1. Interactive login (device flow):
   $ delta auth login

   Opens a URL in your browser. Enter the displayed code, then
   authenticate via OAuth + 2FA. The CLI waits and stores the token.

2. Token paste (headless / CI):
   $ delta auth login --token

   Generate a token in the web UI under Settings, then paste it.

3. Environment variable:
   $ export DELTA_TOKEN="your-api-token"

   Highest priority. Useful for CI pipelines and scripts.

Token storage precedence:
   1. DELTA_TOKEN env var
   2. OS keyring (macOS Keychain, GNOME Keyring, KDE Wallet)
   3. ~/.config/delta/credentials.json (0600, fallback)

Other commands:
   delta auth status            Show current user and method
   delta auth logout            Clear stored credentials
   delta auth token             Display current token
   delta auth token regenerate  Regenerate token (invalidates old one)`;
}

function examples(): string {
  return `Workflow Examples

Basic CRUD:
  $ delta task add "Buy groceries" --due tomorrow -c personal
  $ delta task done 5
  $ delta task edit 5 --priority 2 --due friday
  $ delta task delete 5

Filtering:
  $ delta task list category:work
  $ delta task list priority:2 due.before:eow
  $ delta task list --from monday --until friday status:pending

Calendar events:
  $ delta task add "Standup" --start "2026-04-01T09:00" --end "2026-04-01T09:30"
  $ delta task add "Holiday" --due 2026-04-01 --all-day
  $ delta task add "Review" --recurrence "every monday" --start "monday 10:00"

Piping with quiet mode:
  $ delta task list -q status:done | xargs delta task delete -y

JSON scripting:
  $ delta task list --json id,description,status
  $ delta task list --json --jq '.[].description'

Export:
  $ delta export --from today --until +2w > next-two-weeks.ics

Automations:
  $ delta cron add --name "Sync issues" --schedule "0 9 * * 1" --type github_issues
  $ delta cron run 1`;
}

const topics: Record<string, () => string> = {
  filters,
  dates,
  auth: authHelp,
  examples,
};

export function registerHelp(program: Command): void {
  const help = new Command("help")
    .description("Built-in help topics")
    .argument("[topic]", "Help topic (filters, dates, auth, examples)")
    .action((topic?: string) => {
      if (!topic) {
        if (process.stdout.isTTY) {
          try {
            execSync("man delta", { stdio: "inherit" });
            return;
          } catch {
            // fall through
          }
        }
        process.stdout.write(`${overview()}\n`);
        return;
      }

      const fn = topics[topic];
      if (!fn) {
        process.stderr.write(
          `Unknown help topic: ${topic}\nAvailable: ${Object.keys(topics).join(", ")}\n`,
        );
        process.exit(2);
      }
      process.stdout.write(`${fn()}\n`);
    });

  program.addCommand(help);
}
