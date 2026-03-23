# delta (Δ)

A personal, self-hosted todo platform.

## Self-hosting

Requires Node.js 22+, pnpm, and SQLite.

```bash
git clone https://github.com/barrettruth/delta.git && cd delta
pnpm install && pnpm db:generate
mkdir -p data && DATABASE_URL=./data/delta.db pnpm db:migrate
DATABASE_URL=./data/delta.db npx tsx scripts/seed.ts <username> <password>
DATABASE_URL=./data/delta.db pnpm build
cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static
DATABASE_URL=./data/delta.db PORT=3001 node .next/standalone/server.js
```

Put a reverse proxy in front with HTTPS.
