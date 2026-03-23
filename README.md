# delta (Δ)

Personal todo/productivity platform. Self-hosted Next.js app with SQLite.

## Stack

Next.js, TypeScript, Drizzle ORM, SQLite, Tailwind, shadcn/ui, Tiptap, Biome, Vitest

## Setup

```bash
nix develop          # or install node 22 + pnpm manually
pnpm install
pnpm db:generate
mkdir -p data
DATABASE_URL=./data/delta.db npx tsx scripts/seed.ts <username> <password>
pnpm dev
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` | Production build (standalone) |
| `pnpm test` | Run tests |
| `pnpm lint` | Biome check |
| `pnpm typecheck` | TypeScript check |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm ci` | Run all checks |

## CLI

```bash
cd cli && bun build src/main.ts --compile --outfile delta
DELTA_API_URL=https://delta.barrettruth.com DELTA_API_KEY=<key> ./delta list
```

## Deploy

Self-hosted on NixOS with systemd + nginx + ACME. Push to `main` triggers CI → deploy via SSH.
