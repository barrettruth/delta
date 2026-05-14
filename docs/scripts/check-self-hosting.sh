#!/usr/bin/env bash
set -euo pipefail

HOST=${HOST:?set HOST, for example HOST=vps}
DELTA_ORIGIN=${DELTA_ORIGIN:?set DELTA_ORIGIN, for example DELTA_ORIGIN=https://delta.example.com}
SERVICE=${SERVICE:-delta}
APP_DIR=${APP_DIR:-/opt/delta}
DB_PATH=${DB_PATH:-/var/lib/delta/data.db}
BACKUP_TIMER=${BACKUP_TIMER:-delta-r2-backup.timer}

reject_single_quote() {
  case "$2" in
    *"'"*) printf 'error: %s cannot contain a single quote\n' "$1" >&2; exit 2 ;;
  esac
}

for pair in \
  "SERVICE:$SERVICE" \
  "APP_DIR:$APP_DIR" \
  "DB_PATH:$DB_PATH" \
  "BACKUP_TIMER:$BACKUP_TIMER"
do
  reject_single_quote "${pair%%:*}" "${pair#*:}"
done

remote_check() {
  local label=$1
  local command=$2
  printf '==> %s\n' "$label"
  ssh "$HOST" "$command" >/dev/null
}

remote_show() {
  local label=$1
  local command=$2
  printf '==> %s\n' "$label"
  ssh "$HOST" "$command"
}

printf '==> public URL\n'
curl -fsS "$DELTA_ORIGIN/" >/dev/null

remote_check "app checkout exists" "test -d '$APP_DIR'"
remote_show "deployed commit" "cd '$APP_DIR' && git rev-parse --short HEAD"
remote_check "service is active" "systemctl is-active --quiet '$SERVICE'"
remote_check "service uses app directory" "systemctl cat '$SERVICE' | grep -F 'WorkingDirectory=$APP_DIR'"
remote_check "service uses secret env file" "systemctl cat '$SERVICE' | grep -F 'EnvironmentFile=/run/secrets/delta-env'"
remote_check "service starts standalone server" "systemctl cat '$SERVICE' | grep -F '.next/standalone/server.js'"
remote_check "database exists" "test -f '$DB_PATH'"
remote_show "backup timer" "systemctl list-timers --all --no-pager '$BACKUP_TIMER'"

printf 'ok\n'
