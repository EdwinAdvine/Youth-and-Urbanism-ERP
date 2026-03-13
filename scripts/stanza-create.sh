#!/usr/bin/env bash
# stanza-create.sh — Initialize the pgBackRest repository stanza on MinIO.
#
# Run this ONCE after the Patroni cluster is up and MinIO is accessible.
# Creates the stanza configuration in the S3 bucket and takes the first
# full backup so WAL archiving can begin.
#
# Prerequisites:
#   - patroni1 must be running and accepting connections
#   - MinIO must be accessible at the URL configured in pgbackrest.conf
#   - The MinIO bucket "urban-vibes-dynamics-pgbackrest" must exist (auto-created below)
#
# Usage:
#   cd /path/to/urban-vibes-dynamics
#   ./scripts/stanza-create.sh

set -euo pipefail
COMPOSE="docker compose"

echo "====================================================================="
echo " Urban Vibes Dynamics — pgBackRest Stanza Initialization"
echo "====================================================================="
echo ""

# ── Create MinIO bucket if it doesn't exist ───────────────────────────────────
echo "[1/4] Creating MinIO bucket urban-vibes-dynamics-pgbackrest..."
$COMPOSE exec -T minio mc alias set local http://localhost:9000 \
    "${MINIO_ACCESS_KEY:-minioadmin}" "${MINIO_SECRET_KEY:-minioadmin123}" 2>/dev/null || true
$COMPOSE exec -T minio mc mb local/urban-vibes-dynamics-pgbackrest --ignore-existing
echo "      Bucket ready."

# ── Create the pgBackRest stanza on patroni1 ─────────────────────────────────
echo "[2/4] Creating pgBackRest stanza 'urban-vibes-dynamics'..."
$COMPOSE exec -T patroni1 pgbackrest --stanza=urban-vibes-dynamics stanza-create
echo "      Stanza created."

# ── Check the stanza configuration ───────────────────────────────────────────
echo "[3/4] Verifying stanza..."
$COMPOSE exec -T patroni1 pgbackrest --stanza=urban-vibes-dynamics check
echo "      Stanza check passed."

# ── Take the first full backup ────────────────────────────────────────────────
echo "[4/4] Taking first full backup (this may take several minutes)..."
$COMPOSE exec -T patroni1 pgbackrest --stanza=urban-vibes-dynamics --type=full backup
echo "      Full backup complete."

echo ""
echo "====================================================================="
echo " Stanza initialization complete!"
echo ""
echo " pgBackRest info:"
$COMPOSE exec -T patroni1 pgbackrest --stanza=urban-vibes-dynamics info
echo ""
echo " Scheduled backups (via Celery beat):"
echo "   Full:        Sundays   1:00 AM UTC"
echo "   Differential: Daily    2:00 AM UTC"
echo "   Verify:      Wednesdays 4:00 AM UTC"
echo "====================================================================="
