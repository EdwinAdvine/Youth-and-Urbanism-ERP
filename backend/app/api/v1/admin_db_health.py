"""Admin database health endpoint — Super Admin only.

Provides a real-time snapshot of the database cluster health for the
Admin Dashboard DatabaseHealthWidget:

    GET /api/v1/admin/db-health

Returns:
    - Replication status: primary node + replica lag for each standby
    - Connection pool stats: active/waiting/idle connections via PgBouncer
    - Last backup info: timestamp, type, age
    - PostgreSQL version and cluster mode (single / patroni-ha)

All queries use the read replica session where available to avoid
adding load to the primary for monitoring traffic.
"""


import json
import logging
import subprocess
from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from app.core.deps import ReadDBSession, SuperAdminUser

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", summary="Database cluster health (Super Admin)")
async def db_health(
    current_user: SuperAdminUser,
    db: ReadDBSession,
):
    """Return database health metrics for the Admin Dashboard."""

    result: dict = {
        "cluster_mode": "unknown",
        "replication": [],
        "connections": {},
        "backup": {},
        "postgres_version": None,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }

    # ── PostgreSQL version ────────────────────────────────────────────────────
    try:
        row = await db.execute(text("SELECT version()"))
        result["postgres_version"] = row.scalar()
    except Exception:
        pass

    # ── Replication status (pg_stat_replication) ──────────────────────────────
    try:
        rows = await db.execute(text("""
            SELECT
                application_name,
                state,
                sync_state,
                EXTRACT(EPOCH FROM write_lag)::int    AS write_lag_s,
                EXTRACT(EPOCH FROM replay_lag)::int   AS replay_lag_s,
                pg_wal_lsn_diff(sent_lsn, replay_lsn) / 1048576.0 AS lag_mb
            FROM pg_stat_replication
            ORDER BY application_name;
        """))
        replicas = []
        for r in rows.mappings():
            replicas.append({
                "name": r["application_name"],
                "state": r["state"],
                "sync_state": r["sync_state"],
                "write_lag_s": r["write_lag_s"] or 0,
                "replay_lag_s": r["replay_lag_s"] or 0,
                "lag_mb": float(r["lag_mb"] or 0),
            })
        result["replication"] = replicas
        result["cluster_mode"] = "patroni-ha" if replicas else "single-node"
    except Exception as exc:
        logger.debug("Replication query failed: %s", exc)

    # ── Active connections ────────────────────────────────────────────────────
    try:
        rows = await db.execute(text("""
            SELECT
                state,
                COUNT(*) AS count
            FROM pg_stat_activity
            WHERE datname = current_database()
            GROUP BY state;
        """))
        conn_stats = {r["state"] or "unknown": r["count"] for r in rows.mappings()}
        result["connections"] = {
            "active": conn_stats.get("active", 0),
            "idle": conn_stats.get("idle", 0),
            "idle_in_transaction": conn_stats.get("idle in transaction", 0),
            "waiting": conn_stats.get("waiting", 0),
        }
    except Exception as exc:
        logger.debug("Connection stats query failed: %s", exc)

    # ── Backup status (pgBackRest) ────────────────────────────────────────────
    try:
        proc = subprocess.run(
            ["pgbackrest", "--stanza=urban-vibes-dynamics", "--output=json", "info"],
            capture_output=True, text=True, timeout=10,
        )
        if proc.returncode == 0:
            info = json.loads(proc.stdout)
            stanza = info[0] if info else {}
            backups = stanza.get("backup", [])
            if backups:
                last = backups[-1]
                stop_ts = last.get("timestamp", {}).get("stop", 0)
                stop_dt = datetime.fromtimestamp(stop_ts, tz=timezone.utc) if stop_ts else None
                age_s = int(datetime.now(timezone.utc).timestamp()) - stop_ts if stop_ts else None
                result["backup"] = {
                    "type": last.get("type"),
                    "completed_at": stop_dt.isoformat() if stop_dt else None,
                    "age_seconds": age_s,
                    "size_mb": last.get("info", {}).get("size", 0) / 1048576,
                    "backup_count": len(backups),
                    "archive_status": "ok" if stanza.get("archive") else "no_archive",
                }
            else:
                result["backup"] = {"status": "no_backups"}
        else:
            result["backup"] = {"status": "pgbackrest_unavailable"}
    except FileNotFoundError:
        result["backup"] = {"status": "pgbackrest_not_installed", "note": "single-node pg_dump mode"}
    except Exception as exc:
        logger.debug("pgBackRest info failed: %s", exc)
        result["backup"] = {"status": "error", "error": str(exc)}

    # ── Disk usage ────────────────────────────────────────────────────────────
    try:
        row = await db.execute(text("""
            SELECT
                pg_database_size(current_database()) AS db_size_bytes,
                pg_size_pretty(pg_database_size(current_database())) AS db_size_pretty;
        """))
        r = row.mappings().one()
        result["disk"] = {
            "db_size_bytes": r["db_size_bytes"],
            "db_size_pretty": r["db_size_pretty"],
        }
    except Exception:
        pass

    return result
