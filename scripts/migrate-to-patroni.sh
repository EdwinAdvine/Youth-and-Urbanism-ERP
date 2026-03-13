#!/usr/bin/env bash
# migrate-to-patroni.sh — One-time migration from single PostgreSQL container
# to Patroni 3-node HA cluster.
#
# IMPORTANT: This causes ~15–30 minutes of database downtime.
# Run during a scheduled maintenance window.
#
# Prerequisites:
#   - All services (backend, celery, etc.) must be stopped before running.
#   - The old urban-vibes-dynamics-postgres container must still be running.
#   - etcd and patroni1 containers must NOT yet be started.
#
# Usage:
#   cd /path/to/urban-vibes-dynamics
#   ./scripts/migrate-to-patroni.sh
#
# After success:
#   docker compose up -d  (starts the full HA stack)

set -euo pipefail
COMPOSE="docker compose"
DUMP_FILE="/tmp/urban-vibes-dynamics-migration-$(date +%Y%m%d_%H%M%S).sql"

echo "====================================================================="
echo " Urban Vibes Dynamics — Single Postgres → Patroni HA Cluster Migration"
echo "====================================================================="
echo ""

# ── Step 1: Stop all application services ────────────────────────────────────
echo "[1/7] Stopping application services (keeping postgres running)..."
$COMPOSE stop backend celery-worker celery-beat frontend || true
echo "      Application services stopped."

# ── Step 2: Dump from the existing single postgres container ─────────────────
echo "[2/7] Dumping existing database to ${DUMP_FILE}..."
$COMPOSE exec -T postgres pg_dump \
    --no-password \
    -U urban \
    -d urban_erp \
    --format=plain \
    --no-owner \
    --no-privileges \
    > "${DUMP_FILE}"
echo "      Dump complete: $(du -h "${DUMP_FILE}" | cut -f1)"

# ── Step 3: Stop the old postgres container ───────────────────────────────────
echo "[3/7] Stopping old postgres container..."
$COMPOSE stop postgres
echo "      Old postgres stopped."

# ── Step 4: Start etcd ────────────────────────────────────────────────────────
echo "[4/7] Starting etcd (DCS for Patroni)..."
$COMPOSE up -d etcd
echo "      Waiting 5s for etcd to be ready..."
sleep 5
echo "      etcd running."

# ── Step 5: Bootstrap Patroni primary (patroni1) ─────────────────────────────
echo "[5/7] Starting patroni1 (cluster bootstrap)..."
$COMPOSE up -d patroni1
echo "      Waiting 15s for cluster to bootstrap..."
sleep 15

# Wait until patroni1 is the primary
MAX_WAIT=60
WAITED=0
until $COMPOSE exec -T patroni1 curl -s http://localhost:8008/primary | grep -q "running"; do
    echo "      Waiting for patroni1 to become primary... (${WAITED}s)"
    sleep 5
    WAITED=$((WAITED + 5))
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo "ERROR: patroni1 did not become primary within ${MAX_WAIT}s"
        echo "       Check logs: docker compose logs patroni1"
        exit 1
    fi
done
echo "      patroni1 is primary."

# ── Step 6: Restore the dump into patroni1 ───────────────────────────────────
echo "[6/7] Restoring database dump into patroni1..."
cat "${DUMP_FILE}" | $COMPOSE exec -T patroni1 psql \
    -U postgres \
    -d postgres \
    -c "CREATE DATABASE urban_erp OWNER urban;" 2>/dev/null || true
cat "${DUMP_FILE}" | $COMPOSE exec -T patroni1 psql \
    -U urban \
    -d urban_erp

echo "      Database restored."

# ── Step 7: Start remaining Patroni nodes, PgBouncer, HAProxy ────────────────
echo "[7/7] Starting patroni2, patroni3 (streaming replication begins)..."
$COMPOSE up -d patroni2 patroni3
echo "      Waiting 20s for replicas to start streaming..."
sleep 20

echo "      Starting PgBouncer and HAProxy..."
$COMPOSE up -d pgbouncer haproxy
sleep 3

# ── Verification ──────────────────────────────────────────────────────────────
echo ""
echo "====================================================================="
echo " Verification"
echo "====================================================================="

echo ""
echo "Cluster members:"
$COMPOSE exec -T patroni1 curl -s http://localhost:8008/cluster | python3 -m json.tool 2>/dev/null || \
    echo "  (install python3 for pretty output)"

echo ""
echo "HAProxy primary:"
$COMPOSE exec -T haproxy curl -s http://localhost:7000/stats 2>/dev/null | grep -c "patroni" && echo "HAProxy responding" || true

echo ""
echo "PgBouncer pool:"
$COMPOSE exec -T pgbouncer psql -h localhost -p 6432 -U urban -d pgbouncer -c "SHOW POOLS;" 2>/dev/null || \
    echo "  (connect manually to verify: docker compose exec pgbouncer psql -h localhost -p 6432 -U urban -d pgbouncer -c 'SHOW POOLS;')"

echo ""
echo "====================================================================="
echo " Migration complete!"
echo ""
echo " Next steps:"
echo "   1. Start the application stack:"
echo "      docker compose up -d"
echo ""
echo "   2. Run pending Alembic migrations:"
echo "      docker compose exec backend alembic upgrade head"
echo ""
echo "   3. Initialize pgBackRest stanza:"
echo "      ./scripts/stanza-create.sh"
echo ""
echo "   4. Verify the dump file and remove if not needed:"
echo "      rm ${DUMP_FILE}"
echo "====================================================================="
