#!/usr/bin/env bash
set -uo pipefail

REMOTE_HOST="${REMOTE_HOST:-root@217.13.101.122}"
REMOTE_DB="${REMOTE_DB:-video_recomm_bridge}"
REMOTE_USER="${REMOTE_USER:-video_recomm_bridge}"
LOCAL_DUMP="${LOCAL_DUMP:-videobridge_local.dump}"
REMOTE_DUMP="/tmp/${LOCAL_DUMP}"

log() {
  echo "[$(date +'%H:%M:%S')] $*"
}

if [[ "${FORCE:-}" != "1" ]]; then
  read -r -p "A VPS adatbázisa teljesen felül lesz írva. Folytatod? [y/N] " answer
  if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
    log "Megszakítva."
    exit 0
  fi
fi

set -x

log "Checking local docker container..."
docker ps --format '{{.Names}}' | grep -qx 'videobridge-db' || {
  echo "Local container videobridge-db is not running." >&2
  exit 1
}

log "Creating local dump..."
docker exec videobridge-db pg_dump -U "$REMOTE_USER" -d "$REMOTE_DB" -F c > "./$LOCAL_DUMP"

log "Verifying local dump exists..."
ls -lh "./$LOCAL_DUMP"

log "Checking remote docker container..."
ssh "$REMOTE_HOST" "docker ps --format '{{.Names}}' | grep -qx 'videobridge-db' && echo 'container ok' || { echo 'container missing'; exit 1; }"

log "Uploading dump..."
scp "./$LOCAL_DUMP" "$REMOTE_HOST:$REMOTE_DUMP"

log "Verifying remote dump exists..."
ssh "$REMOTE_HOST" "ls -lh '$REMOTE_DUMP'"

log "Restoring VPS database..."
ssh "$REMOTE_HOST" "docker cp '$REMOTE_DUMP' videobridge-db:/tmp/$LOCAL_DUMP"
ssh "$REMOTE_HOST" "docker exec videobridge-db psql -U '$REMOTE_USER' -d '$REMOTE_DB' -c 'CREATE EXTENSION IF NOT EXISTS vector;'"
ssh "$REMOTE_HOST" "docker exec videobridge-db pg_restore -U '$REMOTE_USER' -d '$REMOTE_DB' --clean --if-exists /tmp/$LOCAL_DUMP"

log "Removing temporary remote dump..."
ssh "$REMOTE_HOST" "rm -f '$REMOTE_DUMP'"

log "Done"
