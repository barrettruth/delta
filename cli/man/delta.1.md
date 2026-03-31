delta(1) -- CLI client for the delta productivity platform

## SYNOPSIS

`delta` \[`--json` \[fields\]\] \[`--jq` expr\] \[`-q`|`--quiet`\] \[`--no-color`\] \[`--server` url\] \[`--debug`\] <command> \[args\] \[flags\] \[filters\]

## DESCRIPTION

**delta** is a command-line interface for managing tasks, calendar events,
categories, automations, and integrations on the delta productivity platform. It
communicates with a delta server over HTTPS.

The CLI follows a noun-verb grammar: `delta <noun> <verb> [args] [--flags]
[filters]`. Flags are used for writes, filters for reads.

Running `delta` with no arguments is equivalent to `delta task list`, showing
pending tasks sorted by urgency.

## COMMANDS

### delta task

Task CRUD and status changes. Running `delta task` with no verb defaults to
`delta task list`.

* `delta task list` \[`--from` date\] \[`--until` date\] \[filters\]:
  List tasks. Accepts filter expressions and date range flags.

* `delta task add` description \[flags\]:
  Create a new task. The description is a positional argument (quote multi-word
  strings).

* `delta task edit` id \[flags\]:
  Update fields on an existing task.

* `delta task done` id...:
  Mark one or more tasks as complete.

* `delta task delete` id...:
  Soft-delete (cancel) one or more tasks. Bulk deletes require `-y` or
  interactive confirmation.

* `delta task wip` id...:
  Set one or more tasks to wip status.

* `delta task block` id...:
  Set one or more tasks to blocked status.

* `delta task pending` id...:
  Set one or more tasks to pending status.

* `delta task dep add` id depends-on-id:
  Add a dependency between two tasks.

* `delta task dep rm` id depends-on-id:
  Remove a dependency between two tasks.

* `delta task dep list` id:
  List dependencies for a task.

#### Task add/edit flags

* `-d`, `--due` date:
  Due date. Accepts natural language (see DATE FORMATS) or ISO 8601.

* `-c`, `--category` name:
  Category name. Categories are created implicitly.

* `-p`, `--priority` n:
  Priority level. 0 = none, 1+ = ascending urgency.

* `--start` datetime:
  Start time. Creates a calendar event when used with `--end`.

* `--end` datetime:
  End time for calendar events.

* `--all-day`:
  Mark as an all-day event. Use with `--due` (date only, no time).

* `--recurrence` text:
  Recurrence rule. Accepts NLP text (e.g. "every monday") or raw RRULE.

* `--recur-mode` mode:
  Recurrence mode: `scheduled` or `completion`.

* `--location` text:
  Location string.

* `--meeting` url:
  Meeting URL.

* `--notes` text:
  Plain text notes. Pass `-` to read from stdin.

* `--status` status:
  Initial status (default: pending).

#### Task edit-only flags

* `--scope` scope:
  Recurrence edit scope: `this`, `future`, or `all`. Required when editing a
  recurring task. In interactive mode the CLI prompts if omitted; in
  non-interactive mode it errors.

### delta cat

* `delta cat`:
  List all categories with their task counts.

### delta cron

Manage scheduled automations. Running `delta cron` with no verb defaults to
`delta cron list`.

* `delta cron list`:
  List all automations.

* `delta cron add` \[flags\]:
  Create an automation.

* `delta cron edit` id \[flags\]:
  Update an automation.

* `delta cron delete` id:
  Delete an automation.

* `delta cron run` id:
  Trigger an automation manually.

* `delta cron enable` id:
  Enable a disabled automation.

* `delta cron disable` id:
  Disable an automation.

#### Cron add/edit flags

* `--name` name:
  Automation name.

* `--schedule` cron-expr:
  Cron expression (e.g. "0 9 \* \* 1" for every Monday at 9am).

* `--type` type:
  Recipe type: `github_issues`, `webhook`, or `custom`.

* `--config` json:
  JSON configuration blob. Pass `-` to read from stdin.

### delta auth

Authentication commands.

* `delta auth login`:
  Start device flow authentication. Opens a browser URL and waits for
  confirmation.

* `delta auth login --token`:
  Paste an API token directly (for headless/CI environments).

* `delta auth logout`:
  Clear stored credentials from keyring and credentials file.

* `delta auth status`:
  Show the current authenticated user and auth method.

* `delta auth token`:
  Display the current API token.

* `delta auth token regenerate`:
  Regenerate the API token (invalidates the previous token).

### delta sync

* `delta sync`:
  Trigger a Google Calendar synchronization.

### delta feed

iCal feed management. Running `delta feed` with no verb shows the current feed
URL or status.

* `delta feed generate`:
  Generate or regenerate the iCal feed URL.

* `delta feed revoke`:
  Revoke the current feed URL.

### delta import

* `delta import` file.ics \[`--category` name\]:
  Import events from an iCal file. Optionally assign all imported events to a
  category.

* `delta import taskwarrior` export-file:
  Import tasks from a Taskwarrior JSON export.

* `delta import pending` export-file:
  Import tasks from a pending.nvim export.

### delta export

* `delta export` \[`--from` date\] \[`--until` date\] \[filters\]:
  Export tasks and events as iCal to stdout. Redirect to save:
  `delta export > calendar.ics`.

* `delta export --id` id:
  Export a single event as iCal.

### delta config

Settings management. Running `delta config` with no verb shows all settings.

* `delta config get` key:
  Get the value of a setting.

* `delta config set` key value:
  Set a setting value.

Valid keys: `default-view`, `show-completed`, `urgency-weights`,
`conflict-strategy`, `sync-interval`, `geo-provider`.

### delta integration

* `delta integration list`:
  List configured integrations. Running `delta integration` with no verb
  defaults to list.

* `delta integration test` provider:
  Test an integration's API key validity.

### delta invite

Invite link management. Running `delta invite` with no verb defaults to
`delta invite list`.

* `delta invite list`:
  List invite links.

* `delta invite create`:
  Generate a new invite link.

### delta share

* `delta share` task-id:
  Generate or show the share link for a task.

### delta completion

* `delta completion bash`:
  Output bash shell completion script.

* `delta completion zsh`:
  Output zsh shell completion script.

* `delta completion fish`:
  Output fish shell completion script.

Install example: `delta completion zsh > ~/.zfunc/_delta`

### delta help

* `delta help`:
  Show overview and command cheatsheet. If running in a terminal and the man
  page is installed, opens `man delta` instead.

* `delta help filters`:
  Show filter syntax reference.

* `delta help dates`:
  Show date format reference.

* `delta help auth`:
  Show authentication setup walkthrough.

* `delta help examples`:
  Show workflow recipes and usage examples.

## OPTIONS

Universal flags accepted by every command:

* `-h`, `--help`:
  Show help for the current command.

* `--json` \[fields\]:
  Output as JSON. Optionally pass a comma-separated list of fields to include.

* `--jq` expr:
  Filter JSON output with a jq expression (implies `--json`).

* `-q`, `--quiet`:
  Quiet mode. Print only IDs on list commands, nothing on success for mutations.

* `--no-color`:
  Disable colored output. Also respected via the `NO_COLOR` environment
  variable.

* `--server` url:
  Override the server URL. Also settable via `DELTA_SERVER` environment variable
  or the config file.

* `--debug`:
  Print HTTP requests and responses to stderr.

* `-y`, `--yes`:
  Skip confirmation prompts for destructive bulk operations.

## FILTERS

Filters use `key:value` syntax and are passed as positional arguments to list
commands. Date-type keys support `.before` and `.after` modifiers.

### Filter keys

* `status`:value:
  Filter by task status. Values: `pending`, `wip`, `done`, `blocked`,
  `cancelled`.

* `category`:name:
  Filter by category name.

* `priority`:n:
  Filter by priority level.

* `due`:date, `due.before`:date, `due.after`:date:
  Filter by due date, or tasks due before/after a date.

* `created.before`:date, `created.after`:date:
  Filter by creation date.

* `updated.before`:date, `updated.after`:date:
  Filter by last-updated date.

* `sort`:field:
  Sort results. Fields: `urgency` (default), `due`, `created`, `priority`.

* `limit`:n:
  Maximum number of results to return.

### Date range shorthand

The `--from` and `--until` flags on `delta task list` and `delta export` are
shorthand for date ranges on `startAt`:

    delta task list --from monday --until friday

## DATE FORMATS

All date and datetime flags accept the following formats:

### Relative dates

* `today`, `tomorrow`, `yesterday`
* Day names: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`,
  `sunday` (refers to the next occurrence)
* `eow` (end of week), `eom` (end of month)
* `next week`, `next month`

### Offset syntax

* `+3d` (3 days from now)
* `+1w` (1 week from now)
* `+2m` (2 months from now)

### ISO 8601

* Date: `2026-04-01`
* Datetime: `2026-04-01T09:00:00`

## CONFIGURATION

### Config file

Location: `$XDG_CONFIG_HOME/delta/config.toml` (default: `~/.config/delta/config.toml`)

Example:

    server = "https://delta.barrettruth.com"

### Precedence

Configuration values are resolved in order of decreasing priority:

1. Command-line flags (`--server`, `--json`, etc.)
2. Environment variables (`DELTA_SERVER`, `DELTA_TOKEN`, `NO_COLOR`)
3. Config file
4. Built-in defaults

### Environment variables

* `XDG_CONFIG_HOME`:
  Base directory for config files (default: `~/.config`).

* `XDG_DATA_HOME`:
  Base directory for data files including credentials (default: `~/.local/share`).

* `DELTA_SERVER`:
  Server URL (default: `https://delta.barrettruth.com`).

* `DELTA_TOKEN`:
  API token. Highest-priority auth method.

* `NO_COLOR`:
  When set (any value), disables colored output.

### Auth token storage

Token precedence (highest to lowest):

1. `DELTA_TOKEN` environment variable
2. OS keyring (macOS Keychain, GNOME Keyring, KDE Wallet)
3. `$XDG_DATA_HOME/delta/credentials.json` (default: `~/.local/share/delta/credentials.json`, permissions 0600)

## EXIT CODES

* `0`:
  Success.

* `1`:
  Runtime or unknown error.

* `2`:
  Usage or validation error (bad arguments, missing required flags).

* `3`:
  Resource not found.

* `4`:
  Unauthorized (missing or invalid credentials).

## EXAMPLES

### Basic task operations

Create a task with a due date and category:

    $ delta task add "Buy groceries" --due tomorrow --category personal

Complete a task:

    $ delta task done 5

Set multiple tasks to wip:

    $ delta task wip 3 7 12

Edit a task's priority and due date:

    $ delta task edit 5 --priority 2 --due friday

Delete (cancel) a task:

    $ delta task delete 5

### Filtering tasks

List tasks in a category:

    $ delta task list category:work

List high-priority tasks due before end of week:

    $ delta task list priority:2 due.before:eow

List tasks created in the last week, sorted by due date:

    $ delta task list created.after:-7d sort:due

List tasks for a date range:

    $ delta task list --from monday --until friday status:pending

### Calendar events

Create an event with start and end times:

    $ delta task add "Team standup" --start "2026-04-01T09:00" --end "2026-04-01T09:30" --category work

Create an all-day event:

    $ delta task add "Company holiday" --due 2026-04-01 --all-day

Create a recurring event:

    $ delta task add "Weekly review" --start "monday 10:00" --end "monday 11:00" --recurrence "every monday"

Edit a single instance of a recurring task:

    $ delta task edit 15 --due tomorrow --scope this

### Piping and scripting

Get IDs of completed tasks and delete them:

    $ delta task list -q status:done | xargs delta task delete -y

JSON output for scripting:

    $ delta task list --json id,description,status

Filter JSON with jq:

    $ delta task list --json --jq '.[].description'

Export calendar to file:

    $ delta export --from today --until +2w > next-two-weeks.ics

### Auth setup

Interactive device flow login:

    $ delta auth login

Token-based login for CI:

    $ export DELTA_TOKEN="your-api-token"
    $ delta task list

Or paste a token directly:

    $ delta auth login --token

Check auth status:

    $ delta auth status

### Configuration

Set the server URL:

    $ delta config set server https://delta.barrettruth.com

View all settings:

    $ delta config

### Automations

Create a cron job:

    $ delta cron add --name "Sync GitHub issues" --schedule "0 9 * * 1" --type github_issues --config '{"repo": "barrettruth/delta"}'

List automations:

    $ delta cron list

Trigger an automation manually:

    $ delta cron run 1

## SEE ALSO

Project: https://github.com/barrettruth/delta

Web interface: https://delta.barrettruth.com
