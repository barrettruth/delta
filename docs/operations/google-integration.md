# Google integration

Delta uses one Google OAuth connection for first-party Google integrations.
The connection is provider sync only; it is not app login. Google Tasks and
Google Calendar are pull-only and read-only in the v1 sync model: Delta imports
rows from Google, but it does not write tasks, events, attendees, reminders, or
free/busy state back to Google.

For the full production provider checklist, including API enablement and common
OAuth failure modes, see [self-hosting setup](./self-hosting.md).

## Google Cloud APIs

Enable every Google product API that Delta calls on the same Google Cloud
project that owns the OAuth client. OAuth scopes grant user consent; they do
not enable product APIs on the project.

```sh
gcloud services enable \
  tasks.googleapis.com \
  calendar-json.googleapis.com \
  --project <google-project-id>
```

Delta calls Google Tasks for manual task pulls, Google CalendarList for source
discovery, and Google Calendar Events for manual selected-calendar pulls. All
three paths must use the same OAuth project.

## OAuth client

Create a Google OAuth web client with this redirect URI:

```text
https://<your-delta-origin>/api/integrations/google/callback
```

For local development:

```text
http://localhost:3000/api/integrations/google/callback
```

Set the OAuth credentials in the Delta environment:

```sh
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

If Delta runs behind a proxy where request origins do not match the public
origin, set:

```sh
DELTA_PUBLIC_ORIGIN=https://<your-delta-origin>
```

## Scopes

Delta requests:

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
- `https://www.googleapis.com/auth/calendar.events.readonly`
- `https://www.googleapis.com/auth/tasks.readonly`

`tasks.readonly` is enough for the Google Tasks pull path. The Calendar scopes
let Delta list the user's calendars and read event details without requesting
calendar write access.

## Google Calendar sources

Use Settings -> Calendar -> Google -> Refresh calendars to discover Google
calendars from the connected account.

Delta stores Google calendars in `sync_sources` with source kind
`google_calendar`. Visible calendars are enabled by default. Hidden calendars
are shown in settings with `[hidden]` and start disabled. Read-only calendars
with event-detail access are included. Calendars that only grant
`freeBusyReader` access are excluded because they do not expose event details.

Each selected calendar maps to a Delta category using the Google calendar name
by default. Delta seeds the category color from Google only when that local
category does not already have a color.

Use Settings -> Calendar -> Google -> Pull now in the Google Calendars section
to manually import selected calendars. Delta stores per-calendar sync tokens in
`sync_sources`; if Google expires a token with `410 Gone`, Delta clears that
calendar token, performs a full resync during the same manual pull, and reports
the full resync in the settings summary.

Repeated pulls update existing `google_calendar` external links instead of
creating duplicates. Events with an `iCalUID` that already appears in `.ics`
imports are counted as `duplicate skipped` and are not auto-linked.

Google cancelled/deleted events cancel already-imported rows. Cancelled
recurring instances are stored as master `exdates` when the master is present.

Google Calendar imports preserve Google's all-day exclusive end dates. Timed
events keep the source timezone when Google provides one. RRULE masters,
exceptions, and cancelled instances map into Delta recurrence fields. Hidden
detail private events import as `private event` placeholders with `[private]`
source attributes. Transparent events import normally and are marked `[free]`.

Delta stores provider metadata for later use, including Google event IDs,
`iCalUID`, `htmlLink`, `etag`, sequence, visibility, transparency,
conference data, attendees, attachments, reminders, organizer, creator,
extended properties, source calendar metadata, and the raw Google event payload.
Those metadata fields are preserved only; this v1 does not add attachment,
attendee, reminder, free/busy, raw JSON, or icon-polish features.

Imported Google Calendar rows are normal Delta task rows with
`google_calendar` external links, but user mutation paths reject edits,
deletes, and dependency edits. Only the sync engine updates them from Google.

## Google Tasks pull

Use Settings -> Calendar -> Google -> Pull now.

The pull is manual and repeatable. Delta stores Google task list state in
`sync_sources` and task identity in `task_external_links`, so repeated pulls
update existing imported tasks instead of creating duplicates.

Mapped behavior:

- Google title -> Delta description
- Google notes -> Delta notes
- Google due date -> Delta due date
- Google task list title -> Delta category
- Google completed -> Delta done
- Google deleted -> Delta cancelled for already imported tasks

Deleted Google tasks that were never imported are skipped.

Google Tasks imports are normal Delta task rows with `google_tasks` external
links, but user mutation paths reject edits, deletes, and dependency edits.
Only the sync engine updates them from Google. Legacy Google Tasks list metadata
is migrated into `sync_sources` during pull.

Disconnecting Google hard-removes imported Google Tasks rows, their external
links, imported Google Calendar rows, calendar external links, and Google sync
source state. The Google account connection is also removed.

The pull status summarizes the result, for example:

```text
pulled 12, 3 created, 4 updated, 5 skipped
```

The settings panel also shows the last result. `skipped` means unchanged or
intentionally ignored Google Tasks; deleted Google Tasks that were never
imported are skipped.

## Manual smoke path

After changing Google sync behavior, use this smoke path before merging:

1. Connect Google from Settings -> Calendar -> Google.
2. Refresh calendars and verify visible calendars start on, hidden calendars
   show `[hidden]` and start off, and free/busy-only calendars are absent.
3. Pull Google Tasks and Google Calendars; verify the Settings summaries show
   seen, created, updated, skipped, duplicate skipped, and full resync counts
   when applicable.
4. Open Queue, Kanban, Calendar, and a task detail panel; verify imported
   source indicators, read-only warnings, `[private]`, and `[free]` attributes
   appear without breaking dense layouts.
5. Attempt to edit, delete, drag, or complete an imported Google row; the UI
   should warn that Google imports are read-only and the server should reject
   direct mutation paths.
6. Disconnect Google and verify imported Google Tasks, Google Calendar rows,
   external links, and sync source state are removed while local tasks remain.
