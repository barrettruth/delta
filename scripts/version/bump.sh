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

check_cli_npm_token_secret() {
  local secret_json
  local secret_created

  if ! command -v tea >/dev/null 2>&1; then
    die "tea is required to verify Forgejo action secrets before tagging"
  fi

  secret_json="$(tea actions secrets list --remote origin --output json 2>/dev/null)" ||
    die "could not list Forgejo action secrets"

  secret_created="$(
    SECRET_JSON="$secret_json" node <<'NODE'
const secrets = JSON.parse(process.env.SECRET_JSON || "[]");
const secret = secrets.find((item) => item.name === "NPM_TOKEN");
if (!secret) {
  process.stdout.write("__missing__");
  process.exit(0);
}
process.stdout.write(secret.created || secret.created_at || "");
NODE
  )"

  [ "$secret_created" != "__missing__" ] ||
    die "Forgejo action secret NPM_TOKEN is not configured"

  if [ -z "$secret_created" ]; then
    echo "warning: Forgejo did not return an update time for NPM_TOKEN; expiry preflight is limited" >&2
    return
  fi

  SECRET_CREATED="$secret_created" node <<'NODE'
const created = new Date(process.env.SECRET_CREATED);
const warnDays = Number(process.env.DELTA_NPM_TOKEN_SECRET_WARN_AGE_DAYS || "21");
const maxDays = Number(process.env.DELTA_NPM_TOKEN_SECRET_MAX_AGE_DAYS || "28");

if (!Number.isFinite(created.getTime())) {
  console.error(`warning: could not parse NPM_TOKEN update time: ${process.env.SECRET_CREATED}`);
  process.exit(0);
}

const ageDays = (Date.now() - created.getTime()) / 86400000;
const wholeDays = Math.floor(ageDays);

if (Number.isFinite(maxDays) && maxDays > 0 && ageDays >= maxDays) {
  console.error(
    `error: Forgejo action secret NPM_TOKEN was last updated ${wholeDays} days ago; rotate and sync it before tagging`,
  );
  process.exit(1);
}

if (Number.isFinite(warnDays) && warnDays > 0 && ageDays >= warnDays) {
  console.error(
    `warning: Forgejo action secret NPM_TOKEN was last updated ${wholeDays} days ago; verify npm token expiry before tagging`,
  );
}
NODE
}

check_cli_npm_token_expiry() {
  local expires_at="${DELTA_NPM_TOKEN_EXPIRES_AT:-}"
  local variable_json

  if [ -z "$expires_at" ]; then
    if variable_json="$(tea actions variables list --remote origin --name NPM_TOKEN_EXPIRES_AT --output json 2>/dev/null)"; then
      expires_at="$(
        VARIABLE_OUTPUT="$variable_json" node <<'NODE'
const output = process.env.VARIABLE_OUTPUT || "";
try {
  const variable = JSON.parse(output);
  process.stdout.write(variable.data || variable.value || "");
} catch {
  const match = output.match(/^Value:\s*(.+)$/m);
  process.stdout.write(match ? match[1].trim() : "");
}
NODE
      )"
    fi
  fi

  if [ -z "$expires_at" ]; then
    echo "warning: Forgejo action variable NPM_TOKEN_EXPIRES_AT is not set; falling back to secret update age" >&2
    return
  fi

  NPM_TOKEN_EXPIRES_AT="$expires_at" node <<'NODE'
const expiresAt = process.env.NPM_TOKEN_EXPIRES_AT;
const warnDays = Number(process.env.DELTA_NPM_TOKEN_EXPIRY_WARN_DAYS || "14");
const failDays = Number(process.env.DELTA_NPM_TOKEN_EXPIRY_FAIL_DAYS || "3");

if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
  console.error(`error: NPM_TOKEN_EXPIRES_AT must be YYYY-MM-DD, got ${expiresAt}`);
  process.exit(1);
}

const expiry = new Date(`${expiresAt}T00:00:00Z`);
const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);

if (days < 0) {
  console.error(`error: NPM_TOKEN expired on ${expiresAt}; rotate and sync it before tagging`);
  process.exit(1);
}

if (Number.isFinite(failDays) && failDays >= 0 && days <= failDays) {
  console.error(`error: NPM_TOKEN expires on ${expiresAt} (${days} day(s)); rotate and sync it before tagging`);
  process.exit(1);
}

if (Number.isFinite(warnDays) && warnDays >= 0 && days <= warnDays) {
  console.error(`warning: NPM_TOKEN expires on ${expiresAt} (${days} day(s)); rotate it soon`);
}
NODE
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

  check_cli_npm_token_secret
  check_cli_npm_token_expiry

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
