# Self-hosting setup checklist

This is the external-service checklist for a production Delta deployment. It is
meant to capture the provider setup that is easy to miss when the app itself is
already deployed correctly.

Use your public origin without a trailing slash in the examples below:

```sh
DELTA_ORIGIN=https://delta.example.com
```

## Core environment

Set these in the production service environment:

```sh
NODE_ENV=production
HOSTNAME=127.0.0.1
PORT=3001
DATABASE_URL=/var/lib/delta/data.db
DELTA_PUBLIC_ORIGIN=$DELTA_ORIGIN
INTEGRATION_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

`DELTA_PUBLIC_ORIGIN` is required when Delta runs behind a reverse proxy. OAuth
callbacks and post-callback redirects must use the public origin, not the
internal Next.js URL.

Keep `INTEGRATION_ENCRYPTION_KEY` stable after first deploy. It encrypts stored
provider tokens.

## Google provider sync

Enable the Google APIs for every Google product Delta calls from the same
Google Cloud project that owns the OAuth client. OAuth scopes grant user
consent; they do not enable product APIs on the project.

Recommended production baseline:

```sh
gcloud services enable \
  tasks.googleapis.com \
  calendar-json.googleapis.com \
  --project <google-project-id>
```

Or enable these APIs in Google Cloud Console:

- Google Tasks API
- Google Calendar API

Delta calls the Google Tasks API for manual task pulls, Google CalendarList for
source discovery, and Google Calendar Events for manual selected-calendar
pulls. Google sync is provider sync only; it is not Google login.

Create a Google OAuth web client and add this exact authorized redirect URI:

```text
https://<your-delta-origin>/api/integrations/google/callback
```

For local development, add:

```text
http://localhost:3000/api/integrations/google/callback
```

Set the OAuth client credentials in the production environment:

```sh
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Accepted aliases are also supported:

```sh
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
OAUTH_GOOGLE_CLIENT_ID=...
OAUTH_GOOGLE_CLIENT_SECRET=...
```

Delta requests these scopes for the Google connection:

```text
openid
email
profile
https://www.googleapis.com/auth/calendar.calendarlist.readonly
https://www.googleapis.com/auth/calendar.events.readonly
https://www.googleapis.com/auth/tasks.readonly
```

The manual pull paths call Google Tasks and selected Google Calendar sources.
Discover calendar sources with Settings -> Calendar -> Google -> Refresh
calendars after connecting an account, then use Pull now in the Google Tasks or
Google Calendars section.

Calendar discovery stores one `google_calendar` source row per syncable Google
calendar. Visible calendars start enabled, hidden calendars are shown as
`[hidden]` and start disabled, read-only calendars with event-detail access are
included, and calendars that expose only free/busy access are excluded.

Google Calendar pull stores one sync token per selected calendar source. If
Google returns `410 Gone` for an expired token, Delta clears that token, does a
full resync for that calendar during the same manual pull, and reports the full
resync in Settings.

Google Calendar imports are pull-only and read-only. `iCalUID` matches against
existing `.ics` imports are counted as `duplicate skipped`; Delta does not
auto-link those rows. Hidden-detail private events import as `private event`
placeholders with `[private]` source attributes, and transparent events import
as normal read-only rows marked `[free]`.

Delta preserves provider metadata for Calendar imports, including event IDs,
`iCalUID`, `htmlLink`, `etag`, sequence, visibility, transparency, conference
data, attendees, attachments, reminders, organizer, creator, extended
properties, source calendar metadata, and the raw Google payload. Those fields
are stored for later use; this v1 does not add attachment, attendee, reminder,
free/busy, raw JSON, or icon-polish features.

Google Tasks sync is pull-only and read-only. Imported Google Tasks and Google
Calendar events are normal Delta task rows, but user mutation paths reject
edits, deletes, and dependency edits; only the sync engine updates them from
Google. After a pull, read the Settings -> Calendar -> Google Tasks summary as:

- `created`: new Delta tasks imported from Google Tasks.
- `updated`: Google changes applied locally.
- `cancelled`: already-imported Google tasks cancelled after remote deletion.
- `skipped`: Google tasks that were unchanged or intentionally ignored.

Disconnecting Google hard-removes imported Google Tasks and Google Calendar
rows, their external links, and Google sync source state.

Manual smoke path after deploy: connect Google, refresh calendars, confirm
selected and hidden source states, pull Tasks and Calendars, inspect Queue,
Kanban, Calendar, and task detail source indicators, verify read-only mutation
warnings, then disconnect Google and confirm imported Google rows and sync state
are removed while local tasks remain.

## Geocoding providers

Photon requires no API key and is the built-in fallback.

For Mapbox, set an environment token:

```sh
MAPBOX_ACCESS_TOKEN=...
```

For Google Maps geocoding, enable the Google Maps Platform Geocoding API for the
key's project, then paste the API key in Settings -> Calendar -> Geocoding.

## Recurrence NLP providers

The built-in parser requires no external service.

For Anthropic or OpenAI fallback parsing, paste the provider API key in
Settings -> Calendar -> Recurrence. Delta stores those keys in the encrypted
integration settings table, so `INTEGRATION_ENCRYPTION_KEY` must be configured
before saving provider keys.

## Provider login builds

Current `main` uses a local-owner model plus Google provider sync. Older or
feature builds with `/api/auth/[provider]` login routes use this OAuth pattern:

```sh
OAUTH_REDIRECT_BASE_URL=$DELTA_ORIGIN
```

GitHub OAuth app:

```text
Callback URL: https://<your-delta-origin>/api/auth/callback/github
Scopes requested by Delta: read:user user:email
```

```sh
OAUTH_GITHUB_CLIENT_ID=...
OAUTH_GITHUB_CLIENT_SECRET=...
```

Google login OAuth client:

```text
Callback URL: https://<your-delta-origin>/api/auth/callback/google
Scopes requested by Delta: openid email profile
```

```sh
OAUTH_GOOGLE_CLIENT_ID=...
OAUTH_GOOGLE_CLIENT_SECRET=...
```

GitLab OAuth application:

```text
Redirect URI: https://<your-delta-origin>/api/auth/callback/gitlab
Scopes requested by Delta: read_user
```

```sh
OAUTH_GITLAB_CLIENT_ID=...
OAUTH_GITLAB_CLIENT_SECRET=...
```

Only configure these provider-login variables for a build that actually exposes
the matching `/api/auth/callback/<provider>` route.

## Verification commands

Check the Google connect redirect before trying the browser flow:

```sh
curl -sSI "$DELTA_ORIGIN/api/integrations/google/connect" \
  | awk 'BEGIN{IGNORECASE=1} /^location:/ {print}'
```

The Google authorize URL must contain:

```text
redirect_uri=https%3A%2F%2F<your-delta-origin>%2Fapi%2Fintegrations%2Fgoogle%2Fcallback
```

Check that Delta callback redirects use the public origin:

```sh
curl -sSI "$DELTA_ORIGIN/api/integrations/google/callback?code=fake&state=fake" \
  | awk 'BEGIN{IGNORECASE=1} /^location:/ {print}'
```

Expected shape:

```text
location: https://<your-delta-origin>/settings/calendar?google=invalid-state
```

## Common failures

`redirect_uri_mismatch`: the exact redirect URI in the Google request is missing
from the OAuth client's authorized redirect URIs.

`https://localhost:3001/settings/calendar?google=connected`: Delta is using the
internal upstream URL for its post-callback redirect. Set `DELTA_PUBLIC_ORIGIN`
and deploy a build that uses it for callback redirects.

`Google <product> API request failed (403)` with `SERVICE_DISABLED` or
`accessNotConfigured`: enable the matching API on the OAuth client's Google
Cloud project. For current Google sync, that means `tasks.googleapis.com` for
Tasks and `calendar-json.googleapis.com` for Calendar.

`missing-tasks-scope`: the stored Google token does not include
`https://www.googleapis.com/auth/tasks.readonly`. Reconnect the Google account
after updating the OAuth scopes.

`missing-calendar-scope`: the stored Google token does not include the Calendar
list and event read-only scopes. Reconnect the Google account after updating the
OAuth scopes.
