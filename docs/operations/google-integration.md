# Google integration

Delta uses one Google OAuth connection for first-party Google integrations.
The connection is provider sync only; it is not app login.

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

Current `main` calls Google Tasks for manual pulls. Calendar API is included in
the baseline because Delta already requests the Calendar events scope and future
Calendar sync/write paths should use the same OAuth project.

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
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/tasks.readonly`

`tasks.readonly` is enough for the Google Tasks pull path. Delta does not write
to Google Tasks.

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

Google Tasks is pull-only and read-only in v0.1. Imported Google Tasks are
normal Delta task rows, but user mutation paths reject edits; only the sync
engine updates them from Google.

Disconnecting Google hard-removes imported Google Tasks rows, their external
links, and their Google Task list source state. The Google account connection is
also removed.

The pull status summarizes the result, for example:

```text
pulled 12, 3 created, 4 updated, 5 skipped
```

The settings panel also shows the last result. `skipped` means unchanged or
intentionally ignored Google Tasks; deleted Google Tasks that were never
imported are skipped.
