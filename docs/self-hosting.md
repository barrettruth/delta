# Self-host Delta on NixOS

Delta runs as a small single-user web app behind HTTPS. The architecture is as
follows:

- Next.js standalone server on localhost
- nginx in front
- SQLite database on disk
- systemd service for persistence
- stable secret key for secure credentials

Delta also offers read-only sync with Google Tasks and Google Calendar.

## Recommended Config

I host my delta instance with the following stack. It's possible to do it
without Nix at all, of course, but the documentation does not cover this:

- a NixOS host reachable over SSH
- a domain such as `delta.example.com`
- nginx handling HTTPS
- SOPS, or another secret manager, for service environment files
- the Delta checkout installed at `/opt/delta`

My config can be found [here](https://git.barrettruth.com/barrettruth/nix/src/branch/main/hosts/vps/delta.nix)
for reference.

> [!NOTE]
> Provided scripts are examples that will (most likely) not work for you.
> Tuning them is both necessary and encouraged.

Proceed as follows:

### 1. Choose the public URL

Create the DNS record for the Delta subdomain and decide on the exact public
origin (no trailing slash):

```sh
DELTA_ORIGIN=https://delta.example.com
```

Then, configure nginx to terminate TLS for that host and proxy traffic to the local
Next.js server:

```text
https://delta.example.com -> http://127.0.0.1:3001
```

### 2. Create the app user and directories

Run Delta as its own system user. The production host uses:

```text
user:  delta
group: delta
app:   /opt/delta
data:  /var/lib/delta
db:    /var/lib/delta/data.db
```

Keep `/opt/delta` owned by `delta:delta`. Let systemd create
`/var/lib/delta` with `StateDirectory=delta`, so the database directory exists
before the app starts.

### 3. Add the service environment

Render the production environment into `/run/secrets/delta-env`.

Use these values:

```sh
NODE_ENV=production
HOSTNAME=127.0.0.1
PORT=3001
DATABASE_URL=/var/lib/delta/data.db
DELTA_PUBLIC_ORIGIN=https://delta.example.com
INTEGRATION_ENCRYPTION_KEY=<64-character-hex-secret>
```

`DELTA_PUBLIC_ORIGIN` must be the external HTTPS URL, not the local
`127.0.0.1:3001` server. Generate `INTEGRATION_ENCRYPTION_KEY` with
`openssl rand -hex 32`, then keep it stable after first deploy; changing it
breaks stored provider tokens and encrypted integration settings.

Optional owner name - if not set, the first local owner is named `delta`:

```sh
DELTA_LOCAL_USERNAME=delta
```

### 4. Define the systemd service

Define a `delta.service` in the NixOS host module that runs the standalone
Next.js server from `/opt/delta`:

```text
WorkingDirectory=/opt/delta
ExecStart=node .next/standalone/server.js
User=delta
Group=delta
EnvironmentFile=/run/secrets/delta-env
Restart=on-failure
RestartSec=5
StateDirectory=delta
```

Start the service only after the checkout exists, dependencies have been
installed, and the app has been built.

### 5. Install/deploy the app

For a first install, run `scripts/setup.sh` for the initial setup work:
installing dependencies, building the server, copying static assets, running
migrations, prompting for an owner username, and seeding the first owner.

For normal production updates, run the following to update to the latest code on
`origin/main`, re-install dependencies, fetch bundled fonts, rebuild the server,
migrate the database, and restart the service. Tune as you wish:

```sh
ssh vps 'cd /opt/delta && bash scripts/deploy.sh'
```

### 6. Create the first owner

Open Delta in the browser after the first successful deploy. If the database is
empty and you did not seed an owner with `scripts/setup.sh`, Delta creates the
local owner automatically.

Copy or regenerate the API key from the account settings page. The CLI can use
that key:

```sh
delta config set server "$DELTA_ORIGIN"
printf '%s\n' '<api-key>' | delta auth login --token
delta auth status
```

For scripts, use environment variables instead:

```sh
DELTA_SERVER=$DELTA_ORIGIN
DELTA_TOKEN=<api-key>
```

### 7. Google Integration

Skip this section if you do not want read-only integration with Google Tasks
and/or Google Calendar.

Enable the APIs in the Google Cloud project that owns the OAuth client:

```sh
gcloud services enable \
  tasks.googleapis.com \
  calendar-json.googleapis.com \
  --project <google-project-id>
```

Create a Google OAuth web client with this redirect URI:

```text
https://delta.example.com/api/integrations/google/callback
```

Add the client credentials to `/run/secrets/delta-env`:

```sh
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Redeploy or restart `delta.service`, then connect Google from Settings ->
Calendar. For the detailed smoke path, see
[Google integration](operations/google-integration.md).

### 8. Back up the SQLite database

Production uses `delta-r2-backup.timer` when `/run/secrets/delta-r2-backup-env`
exists.

That secret must provide:

```sh
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=...
```

The current backup job uploads:

```text
/var/lib/delta/data.db -> s3://delta/YYYY-MM-DD/data.db
```

and prunes backups older than 30 days.

Check the timer and latest run:

```sh
ssh vps 'systemctl list-timers delta-r2-backup.timer'
ssh vps 'journalctl -u delta-r2-backup.service -n 50 --no-pager'
```

Delta uses SQLite WAL mode. Treat the backup job as incomplete operational
coverage until a restore has been tested, or change the job to checkpoint the
database, stop Delta briefly, or use the SQLite backup API.

### 9. Verify the deployment

After deploy, run:

```sh
HOST=vps DELTA_ORIGIN=$DELTA_ORIGIN docs/scripts/check-self-hosting.sh
```

The script checks the public URL, app checkout, deployed commit, systemd service
state, service config, database file, and backup timer.
