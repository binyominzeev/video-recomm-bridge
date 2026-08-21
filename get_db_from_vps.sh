#!/usr/bin/env bash
set -uo pipefail

REMOTE_HOST="${REMOTE_HOST:-root@217.13.101.122}"
REMOTE_DB="${REMOTE_DB:-video_recomm_bridge}"
REMOTE_USER="${REMOTE_USER:-video_recomm_bridge}"
LOCAL_DUMP="${LOCAL_DUMP:-videobridge_prod.dump}"
REMOTE_DUMP="/tmp/${LOCAL_DUMP}"

log() {
  echo "[$(date +'%H:%M:%S')] $*"
}

set -x

log "Checking remote docker container..."
ssh "$REMOTE_HOST" "docker ps --format '{{.Names}}' | grep -qx 'videobridge-db' && echo 'container ok' || { echo 'container missing'; exit 1; }"

log "Creating dump on remote host (not inside container)..."
ssh "$REMOTE_HOST" "docker exec videobridge-db pg_dump -U '$REMOTE_USER' -d '$REMOTE_DB' -F c > '$REMOTE_DUMP'"

log "Verifying remote dump exists..."
ssh "$REMOTE_HOST" "ls -l '$REMOTE_DUMP'"

log "Downloading dump..."
scp "$REMOTE_HOST:$REMOTE_DUMP" "./$LOCAL_DUMP"

log "Restoring locally..."
docker compose up -d db

docker cp "./$LOCAL_DUMP" videobridge-db:/tmp/$LOCAL_DUMP
docker exec videobridge-db psql -U "$REMOTE_USER" -d "$REMOTE_DB" -c "CREATE EXTENSION IF NOT EXISTS vector;"
docker exec videobridge-db pg_restore -U "$REMOTE_USER" -d "$REMOTE_DB" --clean --if-exists /tmp/$LOCAL_DUMP

log "Done"
