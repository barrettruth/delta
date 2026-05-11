#!/usr/bin/env bash
set -euo pipefail

die() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: scripts/version/sync-npm-token-from-sops.sh <expires-on>

Syncs the encrypted npm publish token from SOPS into Forgejo Actions and stores
the public expiry metadata used by the CLI release preflight.

Environment:
  DELTA_NPM_TOKEN_SOPS_FILE   SOPS file to decrypt
  DELTA_NPM_TOKEN_SECRET      Forgejo Actions secret name
  DELTA_NPM_TOKEN_EXPIRY_VAR  Forgejo Actions variable name
  DELTA_FORGEJO_REMOTE        Git remote used by tea
EOF
}

case "${1:-}" in
-h | --help)
  usage
  exit 0
  ;;
esac

expires_on="${DELTA_NPM_TOKEN_EXPIRES_AT:-${1:-}}"
[ -n "$expires_on" ] || die "missing token expiry date, expected YYYY-MM-DD"

EXPIRES_ON="$expires_on" node <<'NODE'
const expiresOn = process.env.EXPIRES_ON;
if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
  console.error(`error: expiry date must be YYYY-MM-DD, got ${expiresOn}`);
  process.exit(1);
}
const expiry = new Date(`${expiresOn}T00:00:00Z`);
if (!Number.isFinite(expiry.getTime())) {
  console.error(`error: invalid expiry date: ${expiresOn}`);
  process.exit(1);
}
NODE

command -v sops >/dev/null 2>&1 || die "sops is required to decrypt the token"
command -v tea >/dev/null 2>&1 || die "tea is required to update Forgejo Actions"

sops_file="${DELTA_NPM_TOKEN_SOPS_FILE:-$HOME/.config/nix/secrets/vps/forgejo-action-delta-npm-token}"
secret_name="${DELTA_NPM_TOKEN_SECRET:-NPM_TOKEN}"
expiry_var="${DELTA_NPM_TOKEN_EXPIRY_VAR:-NPM_TOKEN_EXPIRES_AT}"
remote="${DELTA_FORGEJO_REMOTE:-origin}"

[ -f "$sops_file" ] || die "SOPS file not found: $sops_file"

echo "Syncing ${secret_name} from ${sops_file} to Forgejo Actions"
sops -d --extract '["data"]' "$sops_file" |
  tea actions secrets set "$secret_name" --remote "$remote" --stdin >/dev/null

echo "Setting ${expiry_var}=${expires_on}"
tea actions variables set "$expiry_var" "$expires_on" --remote "$remote" >/dev/null

echo "Forgejo Actions ${secret_name} synced; token value was not printed"
