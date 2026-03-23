# delta (Δ)

A personal, self-hosted todo platform.

## Self-hosting

Requires Node.js 22+, pnpm, and SQLite.

```bash
git clone https://github.com/barrettruth/delta.git && cd delta
./scripts/setup.sh
```

Or manually:

```bash
pnpm install
pnpm db:migrate
npx tsx scripts/seed.ts <username> <password>
pnpm build
cp -r .next/static .next/standalone/.next/static
PORT=3001 node .next/standalone/server.js
```

Put a reverse proxy in front with HTTPS.
