#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/version/bump.sh <app|cli> <version|patch|minor|major> [--dry-run]

Prepares a version bump pull request from a clean, up-to-date main branch.

Examples:
  scripts/version/bump.sh cli patch
  scripts/version/bump.sh cli 0.0.4 --dry-run
  scripts/version/bump.sh app minor
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

run() {
  echo "+ $*"
  "$@"
}

surface="${1:-}"
target="${2:-}"
mode="${3:-}"

if [ -z "$surface" ] || [ "$surface" = "-h" ] || [ "$surface" = "--help" ]; then
  usage
  exit 0
fi

[ -n "$target" ] || die "missing version or bump type"

dry_run=false
case "$mode" in
  "")
    ;;
  "--dry-run")
    dry_run=true
    ;;
  *)
    die "unknown option: $mode"
    ;;
esac

case "$surface" in
  app | cli)
    ;;
  *)
    die "surface must be app or cli, got: $surface"
    ;;
esac

[ -f package.json ] || die "run from the repository root"
[ -f scripts/version/cli.mjs ] || die "run from the repository root"

branch="$(git branch --show-current)"
[ "$branch" = "main" ] || die "version bump must run from main, currently on $branch"

[ -z "$(git status --porcelain)" ] || die "working tree must be clean"

run git fetch origin main

local_head="$(git rev-parse HEAD)"
remote_head="$(git rev-parse origin/main)"
[ "$local_head" = "$remote_head" ] || die "main must match origin/main"

current_version="$(node scripts/version/cli.mjs current "$surface")"
[ -n "$current_version" ] || die "could not read current $surface version"

case "$target" in
  major | minor | patch)
    version="$(node scripts/version/cli.mjs next "$surface" "$target")"
    ;;
  *)
    version="${target#v}"
    if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      die "version must look like 1.2.3, got: $target"
    fi
    ;;
esac

if [ "$version" = "$current_version" ]; then
  die "$surface version is already $version"
fi

lowest="$(printf '%s\n%s\n' "$current_version" "$version" | sort -V | head -1)"
if [ "$lowest" != "$current_version" ]; then
  die "target version $version must be greater than current version $current_version"
fi

release_branch="release/${surface}-${version}"

if git show-ref --verify --quiet "refs/heads/${release_branch}"; then
  die "local release branch already exists: $release_branch"
fi

if git ls-remote --exit-code --heads origin "$release_branch" >/dev/null 2>&1; then
  die "remote release branch already exists: $release_branch"
fi

if [ "$dry_run" = false ] && ! command -v tea >/dev/null 2>&1; then
  die "tea is required to open the version bump pull request"
fi

start_head="$local_head"
cleanup_dry_run() {
  if [ "$dry_run" = true ]; then
    echo "+ cleanup dry-run changes"
    git reset --hard "$start_head" >/dev/null
  fi
}
trap cleanup_dry_run EXIT

echo "Preparing $surface $current_version -> $version"

if [ "$dry_run" = false ]; then
  run git switch -c "$release_branch"
fi

run node scripts/version/cli.mjs set "$surface" "$version"

if [ "$surface" = "cli" ]; then
  run just cli-build-publish
fi

run just ci

case "$surface" in
  app)
    run git add package.json
    ;;
  cli)
    run git add cli/package.json cli/man/delta.1
    ;;
esac

if git diff --cached --quiet; then
  die "version bump produced no staged changes"
fi

run git diff --cached --stat

if [ "$dry_run" = true ]; then
  echo "Dry run complete for $surface $version; no commit, branch, or push was kept."
  exit 0
fi

run git commit -m "Bump ${surface} version to ${version}"
run git push -u origin "$release_branch"

pr_body="$(cat <<EOF
## Problem

The $surface package version needs to move from $current_version to $version.

## Solution

Run the maintainer version bump script, sync generated package surfaces, and route the bump through Forgejo branch protection.

## Verification

- just ci
EOF
)"

if [ "$surface" = "cli" ]; then
  pr_body="$pr_body
- just cli-build-publish"
fi

run tea pulls create \
  --remote origin \
  --head "$release_branch" \
  --base main \
  --title "Bump ${surface} version to ${version}" \
  --description "$pr_body"
