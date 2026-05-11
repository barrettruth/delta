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
    pnpm version:check

test: install
    pnpm vitest run --reporter=verbose --coverage.enabled --coverage.reporter=text

build: install
    bash scripts/fetch-fonts.sh
    pnpm build

release surface target *args:
    scripts/version/bump.sh {{surface}} {{target}} {{args}}

ci: lint test build
    @:
