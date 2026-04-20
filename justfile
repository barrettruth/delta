default:
    @just --list

install:
    pnpm install --frozen-lockfile

run: install
    pnpm dev

format:
    ./scripts/biome.sh check --write .

lint: install
    ./scripts/biome.sh check .
    pnpm tsc --noEmit

test: install
    pnpm vitest run --reporter=verbose --coverage.enabled --coverage.reporter=text

fetch-fonts:
    bash scripts/fetch-fonts.sh

build: install fetch-fonts
    pnpm build

cli-install:
    cd cli && bun install --frozen-lockfile

cli-build-local: cli-install
    cd cli && bun run build:local

cli-build-man: cli-install
    cd cli && bun run build:man

cli-build-release: cli-build-local cli-build-man
    @:

cli-build-npm: cli-install
    cd cli && bun run build:npm

cli-build-publish: cli-build-npm cli-build-man
    @:

ci: lint test build
    @:
