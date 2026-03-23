# delta (Δ)

A personal, self-hosted todo platform.

## Self-hosting

Requires Node.js 22+, pnpm, and SQLite.

```bash
git clone https://github.com/barrettruth/delta.git
cd delta
pnpm install
pnpm db:generate
mkdir -p data
DATABASE_URL=./data/delta.db pnpm db:migrate
DATABASE_URL=./data/delta.db npx tsx scripts/seed.ts <username> <password>
DATABASE_URL=./data/delta.db pnpm build
```

Run the standalone server:

```bash
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
DATABASE_URL=/path/to/data.db PORT=3001 node .next/standalone/server.js
```

Put nginx or Caddy in front with HTTPS. The app runs on `PORT` (default 3000).

### NixOS

A systemd service, nginx virtualHost, and R2 backup timer are defined in the project's design docs. See `.ai-docs/design.md` for the full deployment architecture.
