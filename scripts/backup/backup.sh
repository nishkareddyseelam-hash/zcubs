#!/usr/bin/env bash
# Database backup script (D-018, docs/DECISION_LOG.md). Dumps the real
# Postgres database at $DATABASE_URL with pg_dump, compresses it, and
# uploads it to an S3-compatible bucket via the AWS CLI (works with
# Cloudflare R2's free tier — 10 GB storage, no egress fees — or any other
# S3-compatible store; see docs/DEPLOYMENT.md for setup). Run manually, or
# on a schedule via .github/workflows/backup.yml.
#
# Required environment variables:
#   DATABASE_URL          — the Postgres connection string to back up
#   BACKUP_S3_ENDPOINT     — S3-compatible endpoint URL (e.g. your R2 account endpoint)
#   BACKUP_S3_BUCKET       — bucket name to upload into
#   AWS_ACCESS_KEY_ID      — S3-compatible access key
#   AWS_SECRET_ACCESS_KEY  — S3-compatible secret key
#
# If BACKUP_S3_* / AWS_* variables are unset, the script still produces a
# real local dump and exits successfully without attempting an upload —
# useful for a manual local backup, or for trying this script out before
# wiring up bucket credentials. It never fabricates a fake "upload
# succeeded" message when no upload was attempted.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Refusing to run — there is nothing to back up." >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_OUT_DIR:-/tmp/zcubs-backups}"
mkdir -p "$OUT_DIR"
DUMP_FILE="$OUT_DIR/zcubs-${TIMESTAMP}.sql.gz"

echo "Dumping database to $DUMP_FILE ..."
pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip -9 > "$DUMP_FILE"

DUMP_SIZE=$(stat -c%s "$DUMP_FILE" 2>/dev/null || stat -f%z "$DUMP_FILE")
if [ "$DUMP_SIZE" -lt 100 ]; then
  echo "ERROR: dump file is suspiciously small ($DUMP_SIZE bytes) — treating this as a failed backup, not uploading it." >&2
  exit 1
fi
echo "Dump complete: $DUMP_SIZE bytes."

if [ -z "${BACKUP_S3_ENDPOINT:-}" ] || [ -z "${BACKUP_S3_BUCKET:-}" ] || [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
  echo "No BACKUP_S3_ENDPOINT/BACKUP_S3_BUCKET/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY set — leaving the dump at $DUMP_FILE and skipping upload."
  echo "This run did NOT upload anything anywhere. Set those variables to enable real off-server backups."
  exit 0
fi

echo "Uploading to s3://${BACKUP_S3_BUCKET}/backups/$(basename "$DUMP_FILE") ..."
aws s3 cp "$DUMP_FILE" "s3://${BACKUP_S3_BUCKET}/backups/$(basename "$DUMP_FILE")" \
  --endpoint-url "$BACKUP_S3_ENDPOINT"

echo "Upload complete."
rm -f "$DUMP_FILE"
