#!/usr/bin/env bash
# pitr-restore.sh — Point-in-Time Recovery using pgBackRest.
#
# Restores the database to any point within the WAL archive window (up to 90 days).
# Performs the restore on a target Patroni node (default: patroni1).
#
# IMPORTANT: This destroys the current database state on the target node.
# Run during a maintenance window. All application services must be stopped first.
#
# Usage:
#   ./scripts/pitr-restore.sh "2026-03-10 14:30:00"      # restore to specific timestamp
#   ./scripts/pitr-restore.sh latest                       # restore to latest backup
#
# Examples:
#   ./scripts/pitr-restore.sh "2026-03-12 09:15:00+00"
#   ./scripts/pitr-restore.sh "2026-03-12T09:15:00Z"

set -euo pipefail
COMPOSE="docker compose"
TARGET="${1:-}"

if [ -z "$TARGET" ]; then
    echo "Usage: $0 <timestamp|latest>"
    echo "  timestamp: ISO 8601 format, e.g. '2026-03-12 14:30:00'"
    echo "  latest:    restore to the latest available backup point"
    exit 1
fi

echo "====================================================================="
echo " Urban Vibes Dynamics — Point-in-Time Recovery"
echo " Target: ${TARGET}"
echo "====================================================================="
echo ""
echo "WARNING: This will DESTROY the current database state on patroni1."
echo "         Make sure all application services are stopped."
echo ""
read -r -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

# ── Step 1: Stop all application services ────────────────────────────────────
echo "[1/6] Stopping application services..."
$COMPOSE stop backend celery-worker celery-beat 2>/dev/null || true

# ── Step 2: Stop Patroni (all nodes) ─────────────────────────────────────────
echo "[2/6] Stopping Patroni cluster..."
$COMPOSE stop patroni1 patroni2 patroni3 2>/dev/null || true

# ── Step 3: Run pgBackRest restore on patroni1 ───────────────────────────────
echo "[3/6] Restoring database..."

if [ "$TARGET" = "latest" ]; then
    $COMPOSE run --rm \
        -e PATRONI_NAME=restore \
        patroni1 \
        pgbackrest --stanza=urban-vibes-dynamics restore --delta --pg1-path=/var/lib/postgresql/data/pgdata
else
    # Escape the timestamp for shell
    TARGET_ESCAPED=$(printf '%s' "$TARGET" | sed "s/'/''/g")
    $COMPOSE run --rm \
        -e PATRONI_NAME=restore \
        patroni1 \
        pgbackrest --stanza=urban-vibes-dynamics restore --delta \
            --pg1-path=/var/lib/postgresql/data/pgdata \
            "--target=${TARGET}" \
            --target-action=promote \
            --type=time
fi
echo "      Restore complete."

# ── Step 4: Start patroni1 (primary) ─────────────────────────────────────────
echo "[4/6] Starting patroni1 (primary after restore)..."
$COMPOSE up -d patroni1
echo "      Waiting 20s for patroni1 to be ready..."
sleep 20

MAX_WAIT=120
WAITED=0
until $COMPOSE exec -T patroni1 curl -sf http://localhost:8008/primary 2>/dev/null | grep -q "running"; do
    echo "      Still waiting... (${WAITED}s)"
    sleep 5
    WAITED=$((WAITED + 5))
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo "ERROR: patroni1 did not come up as primary within ${MAX_WAIT}s"
        echo "       Check: docker compose logs patroni1"
        exit 1
    fi
done
echo "      patroni1 is primary."

# ── Step 5: Re-initialize replicas (they must resync from restored primary) ───
echo "[5/6] Re-initializing replicas from restored primary..."
# Remove replica data directories so Patroni will re-clone from primary
$COMPOSE run --rm patroni2 sh -c "rm -rf /var/lib/postgresql/data/pgdata/*" 2>/dev/null || true
$COMPOSE run --rm patroni3 sh -c "rm -rf /var/lib/postgresql/data/pgdata/*" 2>/dev/null || true
$COMPOSE up -d patroni2 patroni3

# ── Step 6: Restart application services ─────────────────────────────────────
echo "[6/6] Restarting application services..."
$COMPOSE up -d backend celery-worker celery-beat

echo ""
echo "====================================================================="
echo " PITR restore complete!"
echo " Database restored to: ${TARGET}"
echo ""
echo " IMPORTANT: Run Alembic to verify migration state:"
echo "   docker compose exec backend alembic current"
echo "====================================================================="
