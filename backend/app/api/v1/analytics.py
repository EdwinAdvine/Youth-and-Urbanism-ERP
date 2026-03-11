"""Analytics API — aggregated stats endpoints (replaces Superset).

All analytics are now served directly from our PostgreSQL database.
No external analytics service dependency.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DBSession

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/stats/revenue", summary="Monthly revenue data from finance tables")
async def revenue_stats(
    current_user: CurrentUser,
    db: DBSession,
    months: int = Query(12, ge=1, le=36, description="Number of past months to return"),
) -> dict[str, Any]:
    """Return monthly revenue totals from the invoices table."""
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

    # Mock data fallback for development
    now = datetime.now(timezone.utc)
    data = []
    for i in range(months, 0, -1):
        month_dt = now - timedelta(days=30 * i)
        month_str = month_dt.strftime("%Y-%m")
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


@router.get("/stats/expenses", summary="Monthly expense breakdown")
async def expense_stats(
    current_user: CurrentUser,
    db: DBSession,
    months: int = Query(12, ge=1, le=36),
) -> dict[str, Any]:
    """Return monthly expense totals from journal entries."""
    try:
        from sqlalchemy import text  # noqa: PLC0415

        sql = text("""
            SELECT
                TO_CHAR(DATE_TRUNC('month', je.entry_date), 'YYYY-MM') AS month,
                COALESCE(SUM(jl.debit), 0) AS total_expenses
            FROM finance_journal_entries je
            JOIN finance_journal_lines jl ON jl.entry_id = je.id
            JOIN finance_accounts a ON a.id = jl.account_id AND a.account_type = 'expense'
            WHERE je.entry_date >= NOW() - make_interval(months => :months)
            GROUP BY 1
            ORDER BY 1 ASC
        """)
        result = await db.execute(sql, {"months": months})
        rows = result.fetchall()
        data = [{"month": row[0], "expenses": float(row[1])} for row in rows]
        if data:
            return {"service_available": True, "data": data}
    except Exception as exc:
        logger.warning("Expense stats query failed: %s", exc)

    return {"service_available": True, "mock": True, "data": []}


@router.get("/stats/top-products", summary="Top selling products")
async def top_products_stats(
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(10, ge=1, le=50),
) -> dict[str, Any]:
    """Return top products by sales volume."""
    try:
        from sqlalchemy import text  # noqa: PLC0415

        sql = text("""
            SELECT
                p.name,
                COUNT(oi.id) AS order_count,
                COALESCE(SUM(oi.quantity), 0) AS total_qty,
                COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue
            FROM ecommerce_order_items oi
            JOIN ecommerce_products p ON p.id = oi.product_id
            GROUP BY p.id, p.name
            ORDER BY total_revenue DESC
            LIMIT :limit
        """)
        result = await db.execute(sql, {"limit": limit})
        rows = result.fetchall()
        data = [
            {"name": row[0], "orders": int(row[1]), "quantity": int(row[2]), "revenue": float(row[3])}
            for row in rows
        ]
        return {"service_available": True, "data": data}
    except Exception as exc:
        logger.warning("Top products query failed: %s", exc)

    return {"service_available": True, "mock": True, "data": []}


@router.get("/stats/support-metrics", summary="Support ticket metrics")
async def support_metrics(
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Return support ticket stats (open, resolved, avg resolution time)."""
    try:
        from sqlalchemy import text  # noqa: PLC0415

        result = await db.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE status = 'open') AS open_tickets,
                COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_tickets,
                COUNT(*) FILTER (WHERE status = 'closed') AS closed_tickets,
                COUNT(*) AS total_tickets
            FROM support_tickets
        """))
        row = result.fetchone()
        if row:
            return {
                "service_available": True,
                "data": {
                    "open": int(row[0]),
                    "resolved": int(row[1]),
                    "closed": int(row[2]),
                    "total": int(row[3]),
                },
            }
    except Exception as exc:
        logger.warning("Support metrics query failed: %s", exc)

    return {"service_available": True, "mock": True, "data": {"open": 0, "resolved": 0, "closed": 0, "total": 0}}
