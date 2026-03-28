# Google Calendar Sync — Investigation Findings

## Overview

Pull-only sync: import events from Google Calendar into delta. No write-back.

## Current Infrastructure

### Auth
- WebAuthn + TOTP + password-optional (no OAuth)
- Session-based (7-day TTL) or API key auth
- **No Google OAuth exists** — must be added

### Automation framework (already exists)
- `src/core/automation.ts`: recipe-based system with `registerRecipe(type, handler)`
- `node-cron` for scheduling, started in `src/instrumentation.ts`
- Existing recipes: `github_issues`, `github_dev`
- Pattern: `handler(db, userId, config) => Promise<void>`

### Data model compatibility
- Task fields map well to Google Calendar events:
  - `startAt`/`endAt`/`allDay`/`timezone`/`location`/`meetingUrl`/`recurrence`
  - `exdates`/`rdates`/`recurringTaskId`/`originalStartAt`
- RRULE: both use RFC 5545 — direct compatibility
- **Missing**: `externalId`, `externalSource` columns on tasks table

### Categories
- Freeform `text` field per task (default "Todo")
- Colors in separate `categoryColors` table
- Google Calendar has "calendars" (Work, Personal, etc.) not "categories"
- Need mapping: Google calendar → delta category

## Architecture Decision: OAuth Approach

**Recommended: Manually-obtained refresh token via one-time setup script.**

Since this is a single-user self-hosted app, a full OAuth consent flow in the
UI is over-engineered. Instead:

1. Create Google Cloud project + OAuth 2.0 credentials
2. Run `scripts/google-auth.ts` once: opens browser → consent → prints refresh token
3. Store as env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
4. App refreshes access token on each sync via `POST https://oauth2.googleapis.com/token`

Scope: `calendar.readonly` (pull-only)

## Sync Strategy: syncToken-based incremental

Google Calendar's Events.list supports incremental sync:

1. **Initial sync**: fetch all events (paginated), receive `nextSyncToken`
2. **Subsequent syncs**: pass `syncToken`, receive only changes + new token
3. **Token expired (410 Gone)**: clear token, do full sync

Call with `singleEvents=false` to get master recurring events with RRULE intact
(not expanded instances). Exceptions come as separate events with
`recurringEventId`.

## Schema Changes

### New columns on `tasks`:
```sql
ALTER TABLE tasks ADD externalId TEXT;
ALTER TABLE tasks ADD externalSource TEXT;
```

### New table: `google_sync_state`
```
id, userId, calendarId, calendarName, localCategory, syncToken, lastSyncAt, enabled
```

### New table: `sync_deletions`
```
userId + externalId + externalSource (composite PK), deletedAt
```

## Stateful Tracking (Preventing Re-import)

| Scenario | Action |
|----------|--------|
| Google event not seen locally | Create task |
| Google event exists locally (active) | Update task |
| Google event exists locally (deleted_locally) | Skip |
| Google cancels event | Set local task status=cancelled |
| User deletes synced task locally | Insert into sync_deletions, skip on future syncs |
| User deletes locally, Google updates | Skip (local delete wins) |

**Hook point**: Modify `deleteTaskAction` in `src/app/actions/tasks.ts` — after
`deleteTask(db, id)`, if the returned task has `externalId`/`externalSource`,
insert into `sync_deletions`.

## Category Mapping

Google Calendar → delta category mapping stored in `google_sync_state` table:

| Google Calendar | Local Category |
|----------------|---------------|
| primary | Todo |
| work@gmail.com | Work |
| family@group | Personal |

Configured in settings UI. Auto-creates `categoryColors` entry using Google's
calendar color on first sync.

## Recurrence Mapping

| Google | Delta |
|--------|-------|
| `event.recurrence[0]` (RRULE line) | `tasks.recurrence` |
| EXDATE lines in `event.recurrence` | `tasks.exdates` (JSON array) |
| RDATE lines in `event.recurrence` | `tasks.rdates` (JSON array) |
| Event with `recurringEventId` | Task with `recurringTaskId` + `originalStartAt` |
| Cancelled occurrence | Add to master's `exdates` |

## When to Sync

1. **Cron** (primary): `google_calendar` automation recipe, every 15 min
2. **Manual**: "Sync Now" button in settings → `POST /api/sync/google-calendar`
3. **External**: systemd timer or API key call

## File Structure

```
src/core/google-calendar/
  types.ts      — Google API response types
  client.ts     — Token refresh, Events.list, CalendarList.list
  mapper.ts     — Google event → CreateTaskInput/UpdateTaskInput
  sync.ts       — Core reconciliation loop
src/core/recipes/
  google-calendar.ts  — Recipe handler
src/app/api/sync/google-calendar/
  route.ts            — POST: manual trigger
  calendars/route.ts  — GET: list available calendars
scripts/
  google-auth.ts      — One-time OAuth setup
tests/core/google-calendar/
  client.test.ts
  mapper.test.ts
  sync.test.ts
```

## Most Pressing Design Questions

1. **Calendar selection UX**: Should the settings UI let users pick which Google
   calendars to sync, or sync all by default? (Recommend: opt-in per calendar)

2. **Conflict resolution**: If a user edits a synced event locally AND it changes
   in Google, which wins? (Recommend: Google wins for pull-only, but flag to user)

3. **Notification**: How to inform the user that a sync happened? Options:
   - Toast notification on next page load ("Synced 3 new events from Google")
   - Badge on settings icon
   - Inline in calendar (new events highlighted briefly)
   - No notification (silent sync)

4. **Initial sync volume**: First sync could pull hundreds/thousands of events.
   Should we limit to a time window (e.g., future events only)? Or pull
   everything? (Recommend: `timeMin=now-30d` on initial sync)

5. **Recurring event ownership**: When we import a Google recurring master, delta
   "owns" the expansion. If Google later adds an exception, the incremental sync
   picks it up. But if the user creates a local exception to a Google-synced
   recurring event, that's purely local. Is this confusing?

6. **Labels/sub-categories**: Google events have optional event-level colors
   (separate from calendar colors). Should these map to delta's `label` field?
   Or ignore them?
