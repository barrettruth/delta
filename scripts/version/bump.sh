#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/version/bump.sh <app|cli> <version|patch|minor|major> [--dry-run|--tag]

Prepares a version bump pull request from a clean, up-to-date main branch.
After a CLI bump PR is merged, --tag pushes the cli-v* tag that publishes npm.

Examples:
  scripts/version/bump.sh cli patch
  scripts/version/bump.sh cli 0.0.4 --dry-run
  scripts/version/bump.sh cli 0.0.4 --tag
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

build_cli_publish() {
  run bash -c 'cd cli && bun install --frozen-lockfile && bun run build:npm && bun run build:man'
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
tag_only=false
case "$mode" in
  "")
    ;;
  "--dry-run")
    dry_run=true
    ;;
  "--tag")
    tag_only=true
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

if [ "$tag_only" = true ]; then
  [ "$dry_run" = false ] || die "--dry-run and --tag cannot be combined"
  [ "$surface" = "cli" ] || die "--tag currently only supports cli releases"
  case "$target" in
    major | minor | patch)
      die "--tag requires an explicit version, not a bump type"
      ;;
  esac
  version="${target#cli-v}"
  version="${version#v}"
else
  case "$target" in
    major | minor | patch)
      version="$(node scripts/version/cli.mjs next "$surface" "$target")"
      ;;
    *)
      version="${target#v}"
      ;;
  esac
fi

if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  die "version must look like 1.2.3, got: $target"
fi

if [ "$tag_only" = true ]; then
  package_name="$(node -p "require('./cli/package.json').name")"
  [ "$version" = "$current_version" ] ||
    die "cli/package.json is $current_version; merge the $version bump PR before tagging"

  if command -v tea >/dev/null 2>&1; then
    if ! tea actions secrets list --remote origin --output simple 2>/dev/null \
      | awk '{print $1}' \
      | grep -qx 'NPM_TOKEN'; then
      die "Forgejo action secret NPM_TOKEN is not configured"
    fi
  else
    die "tea is required to verify Forgejo action secrets before tagging"
  fi

  published_version="$(
    npm view "${package_name}@${version}" version --json 2>/dev/null \
      | tr -d '"' || true
  )"
  if [ "$published_version" = "$version" ]; then
    die "${package_name} ${version} is already published on npm"
  fi

  tag="cli-v${version}"
  if git ls-remote --exit-code --tags origin "refs/tags/${tag}" >/dev/null 2>&1; then
    die "remote tag already exists: $tag"
  fi

  if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
    local_tag_target="$(git rev-parse "${tag}^{}")"
    [ "$local_tag_target" = "$local_head" ] ||
      die "local tag $tag points at $local_tag_target, not HEAD $local_head"
  else
    run git tag -a "$tag" -m "$tag"
  fi

  run git push origin "refs/tags/${tag}"

  cat <<EOF

Pushed $tag.
Forgejo will publish ${package_name}@${version} from the cli-release workflow.
EOF
  exit 0
fi

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
  build_cli_publish
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
- cd cli && bun install --frozen-lockfile && bun run build:npm && bun run build:man"
fi

run tea pulls create \
  --remote origin \
  --head "$release_branch" \
  --base main \
  --title "Bump ${surface} version to ${version}" \
  --description "$pr_body"
