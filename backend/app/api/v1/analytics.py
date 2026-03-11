"""Analytics API — Superset guest token + aggregated stats endpoints."""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query, status

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _superset_configured() -> bool:
    url = settings.SUPERSET_URL.strip()
    return bool(url) and url != ""


async def _get_superset_access_token() -> str | None:
    """Obtain a Superset admin access token for the guest-token API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.SUPERSET_URL}/api/v1/security/login",
                json={
                    "username": settings.SUPERSET_ADMIN_USERNAME,
                    "password": settings.SUPERSET_ADMIN_PASSWORD,
                    "provider": "db",
                    "refresh": False,
                },
            )
            resp.raise_for_status()
            return resp.json().get("access_token")
    except Exception as exc:
        logger.warning("Superset login failed: %s", exc)
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/superset-guest-token", summary="Get a Superset guest token for dashboard embedding")
async def get_superset_guest_token(
    current_user: CurrentUser,
    dashboard_id: str | None = Query(None, description="Superset dashboard UUID to embed"),
) -> dict[str, Any]:
    """Return a short-lived Superset guest token for an embedded dashboard.

    If Superset is not configured or unreachable, returns
    ``{"service_available": false}``.
    """
    if not _superset_configured():
        return {"service_available": False, "token": None}

    access_token = await _get_superset_access_token()
    if not access_token:
        return {"service_available": False, "token": None}

    # Default to first available dashboard if none specified
    target_id = dashboard_id or "1"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.SUPERSET_URL}/api/v1/security/guest_token/",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "resources": [{"type": "dashboard", "id": target_id}],
                    "rls": [],
                    "user": {
                        "username": str(current_user.id),
                        "first_name": getattr(current_user, "full_name", "User").split()[0],
                        "last_name": "",
                    },
                },
            )
            resp.raise_for_status()
            token = resp.json().get("token")
            return {
                "service_available": True,
                "token": token,
                "superset_url": settings.SUPERSET_URL,
                "dashboard_id": target_id,
            }
    except Exception as exc:
        logger.warning("Superset guest token failed: %s", exc)
        return {"service_available": False, "token": None}


@router.get("/stats/revenue", summary="Monthly revenue data from finance tables")
async def revenue_stats(
    current_user: CurrentUser,
    db: DBSession,
    months: int = Query(12, ge=1, le=36, description="Number of past months to return"),
) -> dict[str, Any]:
    """Return monthly revenue totals.

    Attempts to query the ``invoices`` table if it exists; falls back to mock
    data so the analytics dashboard always has something to display during
    development.
    """
    try:
        from sqlalchemy import text  # noqa: PLC0415

        sql = text("""
            SELECT
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
                COALESCE(SUM(total), 0) AS revenue
            FROM finance_invoices
            WHERE created_at >= NOW() - make_interval(months => :months)
            GROUP BY 1
            ORDER BY 1 ASC
        """)
        result = await db.execute(sql, {"months": months})
        rows = result.fetchall()
        data = [{"month": row[0], "revenue": float(row[1])} for row in rows]
        if data:
            return {"service_available": True, "data": data}
    except Exception as exc:
        logger.warning("Revenue stats query failed: %s", exc)

    # Mock data: generate a plausible-looking series
    now = datetime.now(timezone.utc)
    data = []
    for i in range(months, 0, -1):
        month_dt = now - timedelta(days=30 * i)
        month_str = month_dt.strftime("%Y-%m")
        # Seed a deterministic but varied value
        seed = (month_dt.year * 100 + month_dt.month) % 50
        revenue = round(15000 + seed * 700 + (i % 3) * 2200, 2)
        data.append({"month": month_str, "revenue": revenue})

    return {"service_available": True, "mock": True, "data": data}


@router.get("/stats/users", summary="User growth data (monthly registrations)")
async def user_growth_stats(
    current_user: CurrentUser,
    db: DBSession,
    months: int = Query(12, ge=1, le=36),
) -> dict[str, Any]:
    """Return monthly new-user counts."""
    try:
        from sqlalchemy import text  # noqa: PLC0415

        sql = text("""
            SELECT
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
                COUNT(*) AS new_users
            FROM users
            WHERE created_at >= NOW() - make_interval(months => :months)
            GROUP BY 1
            ORDER BY 1 ASC
        """)
        result = await db.execute(sql, {"months": months})
        rows = result.fetchall()
        data = [{"month": row[0], "new_users": int(row[1])} for row in rows]
        if data:
            return {"service_available": True, "data": data}
    except Exception as exc:
        logger.warning("User growth query failed: %s", exc)

    now = datetime.now(timezone.utc)
    data = []
    for i in range(months, 0, -1):
        month_dt = now - timedelta(days=30 * i)
        data.append({
            "month": month_dt.strftime("%Y-%m"),
            "new_users": 2 + (i % 5),
        })
    return {"service_available": True, "mock": True, "data": data}


@router.get("/stats/modules", summary="Module usage counts")
async def module_usage_stats(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Return record counts per ERP module for a usage overview card."""
    counts: dict[str, int] = {}

    table_map = {
        "finance_invoices": "Finance",
        "hr_employees": "HR",
        "crm_contacts": "CRM",
        "projects": "Projects",
        "inventory_items": "Inventory",
        "drive_files": "Drive",
        "notes": "Notes",
        "calendar_events": "Calendar",
        "ai_chat_history": "AI Assistant",
        "users": "Users",
    }

    from sqlalchemy import text  # noqa: PLC0415

    for table, label in table_map.items():
        try:
            result = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))  # noqa: S608
            row = result.fetchone()
            counts[label] = int(row[0]) if row else 0
        except Exception:
            counts[label] = 0

    modules = [{"module": k, "count": v} for k, v in counts.items()]
    return {"service_available": True, "modules": modules}
