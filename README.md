# delta (Δ)

A personal, self-hosted todo platform.

<img width="1920" height="1200" alt="Image" src="https://github.com/user-attachments/assets/df4bc3ed-679a-4a14-809d-a9b92327bdf4" />

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
