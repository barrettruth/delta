# Self-Hosting Guide

## Prerequisites

- Node.js 22
- pnpm 10
- SQLite 3
- curl (for font fetching)

If you use Nix, `nix develop` provides all of these via the flake.

## Clone and Install

```sh
git clone https://github.com/barrettruth/delta.git /opt/delta
cd /opt/delta
pnpm install --frozen-lockfile
```

## Environment Variables

Create a `.env.local` in the project root. All variables are optional depending on your setup.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | No | `./data/delta.db` | Absolute path to the SQLite database file |
| `OAUTH_REDIRECT_BASE_URL` | Yes (prod) | `http://localhost:3000` | Public base URL (e.g. `https://delta.example.com`) |
| `OAUTH_GITHUB_CLIENT_ID` | No | — | GitHub OAuth app client ID |
| `OAUTH_GITHUB_CLIENT_SECRET` | No | — | GitHub OAuth app client secret |
| `OAUTH_GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID |
| `OAUTH_GOOGLE_CLIENT_SECRET` | No | — | Google OAuth client secret |
| `OAUTH_GITLAB_CLIENT_ID` | No | — | GitLab OAuth app client ID |
| `OAUTH_GITLAB_CLIENT_SECRET` | No | — | GitLab OAuth app client secret |
| `NODE_ENV` | No | `development` | Set to `production` for rate limiting |
| `PORT` | No | `3000` | Port for the standalone server |
| `HOSTNAME` | No | `localhost` | Hostname to bind to (use `0.0.0.0` for all interfaces) |

At least one OAuth provider must be configured for login to work. The login page only shows buttons for providers that have a `CLIENT_ID` set.

For each OAuth provider, set the callback URL to `{OAUTH_REDIRECT_BASE_URL}/api/auth/callback/{provider}` (e.g. `https://delta.example.com/api/auth/callback/github`).

## Fonts

Delta uses Berkeley Mono and Signifier, both commercial typefaces. The font files are gitignored and must be fetched separately.

The included script downloads them from a private URL:

```sh
bash scripts/fetch-fonts.sh
```

This places `.ttf` files into `src/fonts/`. If you host fonts elsewhere, modify the `BASE_URL` in the script or place the following files manually:

- `src/fonts/BerkeleyMono-Regular.ttf`
- `src/fonts/BerkeleyMono-Italic.ttf`
- `src/fonts/BerkeleyMono-Bold.ttf`
- `src/fonts/BerkeleyMono-BoldItalic.ttf`
- `src/fonts/Signifier-Regular.ttf`

Fonts must be present before building.

## Database Setup

The SQLite database is created automatically at the path specified by `DATABASE_URL` (defaults to `./data/delta.db`). The parent directory is created if it doesn't exist.

Run migrations:

```sh
pnpm db:migrate
```

Migrations live in `drizzle/` and are managed by Drizzle Kit. To generate new migrations after schema changes:

```sh
pnpm db:generate
```

WAL mode and foreign keys are enabled automatically on connection.

## Building and Running

```sh
pnpm build
```

Next.js produces a standalone build (configured via `output: "standalone"` in `next.config.ts`). After building, copy static assets into the standalone output:

```sh
cp -r public .next/standalone/public 2>/dev/null || true
cp -r .next/static .next/standalone/.next/static
```

Run the production server:

```sh
DATABASE_URL=/var/lib/delta/data.db HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js
```

Or using the standard start script (does not use standalone output):

```sh
pnpm start
```

## systemd Service

Create `/etc/systemd/system/delta.service`:

```ini
[Unit]
Description=delta
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/delta
ExecStart=/usr/bin/env node .next/standalone/server.js
Environment=NODE_ENV=production
Environment=DATABASE_URL=/var/lib/delta/data.db
Environment=HOSTNAME=0.0.0.0
Environment=PORT=3000
EnvironmentFile=-/opt/delta/.env.local
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```sh
systemctl daemon-reload
systemctl enable --now delta
```

## NixOS Module

The `flake.nix` provides a dev shell only (no NixOS module). On NixOS, wrap the systemd service in your system configuration manually, or use the deploy script at `scripts/deploy.sh` which pulls, builds, migrates, and restarts the `delta` systemd unit.

## Reverse Proxy

Delta runs on port 3000 by default. Put it behind a reverse proxy for TLS.

### Caddy

```
delta.example.com {
    reverse_proxy localhost:3000
}
```

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name delta.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The app already sets `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` headers via `next.config.ts`.

## CI/CD and Automated Deployment

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on pushes and PRs to `main`:

1. **lint** — Biome check
2. **typecheck** — `tsc --noEmit`
3. **test** — Vitest with coverage
4. **build** — Full Next.js build (depends on lint, typecheck, test passing)
5. **deploy** — SSH into the VPS and run `scripts/deploy.sh` (only on push to `main`)

The deploy job requires a `VPS_SSH_KEY` secret in the GitHub repository's `production` environment.

`scripts/deploy.sh` performs: `git pull` -> `pnpm install` -> font fetch -> `pnpm build` -> copy static assets -> `pnpm db:migrate` -> `systemctl restart delta`.

## Updating

Manual update:

```sh
cd /opt/delta
git pull origin main
pnpm install --frozen-lockfile
bash scripts/fetch-fonts.sh
pnpm build
cp -r .next/static .next/standalone/.next/static
pnpm db:migrate
systemctl restart delta
```

Or just run the deploy script:

```sh
bash /opt/delta/scripts/deploy.sh
```

## Local CI

Before pushing, run the local CI script:

```sh
pnpm ci
```

This runs Biome, TypeScript checking, Vitest, and a full build.
