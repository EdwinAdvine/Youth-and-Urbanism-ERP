"""Partition maintenance — creates monthly partitions for high-write tables.

Run via Celery beat on the 1st of each month to create partitions 3 months ahead.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta

from dateutil.relativedelta import relativedelta

logger = logging.getLogger(__name__)

# Tables that are range-partitioned by created_at (monthly)
PARTITIONED_TABLES = [
    "pos_transactions",
    "chat_messages",
    "finance_journal_entries",
    "stock_movements",
    "analytics_usage_logs",
    "universal_audit_log",
]


def _month_partition_name(table: str, year: int, month: int) -> str:
    return f"{table}_y{year}m{month:02d}"


def generate_partition_sql(months_ahead: int = 3) -> list[str]:
    """Generate CREATE TABLE IF NOT EXISTS statements for future partitions."""
    today = date.today()
    statements: list[str] = []

    for table in PARTITIONED_TABLES:
        for i in range(months_ahead + 1):
            target = today + relativedelta(months=i)
            partition_name = _month_partition_name(table, target.year, target.month)
            start_date = target.replace(day=1)
            end_date = (start_date + relativedelta(months=1))

            sql = (
                f"CREATE TABLE IF NOT EXISTS {partition_name} "
                f"PARTITION OF {table} "
                f"FOR VALUES FROM ('{start_date.isoformat()}') "
                f"TO ('{end_date.isoformat()}');"
            )
            statements.append(sql)

    return statements


async def create_future_partitions() -> int:
    """Create partitions for the next 3 months. Returns number of partitions created."""
    from app.core.database import AsyncSessionLocal  # noqa: PLC0415
    from sqlalchemy import text  # noqa: PLC0415

    statements = generate_partition_sql(months_ahead=3)
    created = 0

    async with AsyncSessionLocal() as session:
        for sql in statements:
            try:
                await session.execute(text(sql))
                created += 1
            except Exception:
                # Partition may already exist or table not yet partitioned
                logger.debug("Partition SQL skipped: %s", sql[:80])
        await session.commit()

    logger.info("Partition maintenance: %d partition statements executed", created)
    return created
