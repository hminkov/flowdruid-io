#!/usr/bin/env bash
# Nightly Postgres backup for the Flowdruid VPS.
#
# Dumps the flowdruid database inside the docker-compose Postgres
# container, gzips, writes to /var/backups/flowdruid/, and prunes
# files older than the retention window.
#
# Install:
#   sudo cp scripts/backup-postgres.sh /usr/local/bin/flowdruid-backup
#   sudo chmod +x /usr/local/bin/flowdruid-backup
#   sudo cp systemd/flowdruid-backup.service /etc/systemd/system/
#   sudo cp systemd/flowdruid-backup.timer /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now flowdruid-backup.timer
#
# Test manually:
#   sudo systemctl start flowdruid-backup.service
#   journalctl -u flowdruid-backup -n 50
#
# Off-host copy: wrap this script or chain a second systemd unit that
# rsync / rclone-sync's /var/backups/flowdruid to S3 / B2 / another VPS.

set -euo pipefail

BACKUP_DIR="${FLOWDRUID_BACKUP_DIR:-/var/backups/flowdruid}"
RETENTION_DAYS="${FLOWDRUID_BACKUP_RETENTION_DAYS:-14}"
CONTAINER="${FLOWDRUID_PG_CONTAINER:-flowdruid-postgres-1}"
DB_USER="${FLOWDRUID_PG_USER:-flowdruid}"
DB_NAME="${FLOWDRUID_PG_NAME:-flowdruid}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT="${BACKUP_DIR}/flowdruid-${STAMP}.sql.gz"

# Dump via the running Postgres container.
# --no-owner / --no-acl so a restore into a differently-named role
# on another host doesn't fail on GRANT statements.
docker exec "$CONTAINER" \
    pg_dump -U "$DB_USER" --no-owner --no-acl "$DB_NAME" \
    | gzip -9 > "$OUT"

SIZE=$(stat -c '%s' "$OUT" 2>/dev/null || stat -f '%z' "$OUT")
if [ "$SIZE" -lt 1024 ]; then
    echo "Backup file suspiciously small ($SIZE bytes); refusing to prune older backups."
    exit 1
fi

# Prune: delete .sql.gz files older than N days.
find "$BACKUP_DIR" -maxdepth 1 -name 'flowdruid-*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete

echo "Backup written: $OUT (${SIZE} bytes)"
