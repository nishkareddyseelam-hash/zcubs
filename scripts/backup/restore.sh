#!/usr/bin/env bash
# Database restore script (D-018, docs/DECISION_LOG.md) — the companion to
# backup.sh. Restoring OVERWRITES data in the target database, so this
# script requires an explicit --yes-i-am-sure flag and always prints
# exactly which database it's about to overwrite before doing anything,
# consistent with this project's standing rule that destructive actions
# are never auto-run (see D-010's data-deletion workflow for the same
# principle applied elsewhere).
#
# Usage:
#   ./scripts/backup/restore.sh path/to/dump.sql.gz --yes-i-am-sure
#
# Requires DATABASE_URL to point at the target database to restore INTO.
set -euo pipefail

DUMP_FILE="${1:-}"
CONFIRM_FLAG="${2:-}"

if [ -z "$DUMP_FILE" ] || [ ! -f "$DUMP_FILE" ]; then
  echo "Usage: $0 path/to/dump.sql.gz --yes-i-am-sure" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set — there is no target database to restore into." >&2
  exit 1
fi

echo "This will restore $DUMP_FILE INTO:"
echo "  $DATABASE_URL"
echo "Every table this dump touches will be OVERWRITTEN. This cannot be undone."

if [ "$CONFIRM_FLAG" != "--yes-i-am-sure" ]; then
  echo
  echo "Refusing to proceed without the --yes-i-am-sure flag. Re-run as:"
  echo "  $0 \"$DUMP_FILE\" --yes-i-am-sure"
  exit 1
fi

echo "Restoring..."
gunzip -c "$DUMP_FILE" | psql "$DATABASE_URL"
echo "Restore complete."
