# Google integration

Delta uses one Google OAuth connection for first-party Google integrations.
The connection is provider sync only; it is not app login.

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

The pull is manual and repeatable. Delta stores Google task identity in
`task_external_links` and updates existing imported tasks instead of creating
duplicates.

Mapped behavior:

- Google title -> Delta description
- Google notes -> Delta notes
- Google due date -> Delta due date
- Google task list title -> Delta category
- Google completed -> Delta done
- Google deleted -> Delta cancelled for already imported tasks

Deleted Google tasks that were never imported are skipped.
