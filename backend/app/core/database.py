"""Async database engine and session factory for Urban Vibes Dynamics.

Configures a SQLAlchemy 2.0 async engine backed by asyncpg (PostgreSQL 16)
and exposes a session factory plus FastAPI dependencies for request-scoped
database sessions.

Two engines are available:
    - ``engine`` / ``AsyncSessionLocal`` — primary write connection
      (points to PgBouncer write port → HAProxy → Patroni primary in HA mode,
       or directly to the postgres container in single-node dev mode)
    - ``read_engine`` / ``ReadAsyncSessionLocal`` — read-replica connection
      (points to PgBouncer readonly port → HAProxy → replica round-robin in HA
       mode, falls back to the primary when READ_DATABASE_URL is empty)

Usage:
    from app.core.database import get_db, get_read_db, AsyncSessionLocal

    # As a FastAPI dependency (preferred):
    @router.get("/items")
    async def list_items(db: AsyncSession = Depends(get_db)):
        ...

    # Read-only query routed to replica:
    @router.get("/analytics/summary")
    async def summary(db: AsyncSession = Depends(get_read_db)):
        ...

    # Manual session (e.g., in Celery tasks or startup hooks):
    async with AsyncSessionLocal() as session:
        ...

PgBouncer compatibility:
    When PGBOUNCER_ENABLED=true the engine is configured for transaction-level
    pooling: pool_pre_ping is disabled (PgBouncer handles keepalives), pool_size
    is reduced (PgBouncer manages the actual PG connections), and statement_cache
    is disabled via prepared_statement_cache_size=0 in the connect_args.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# ── Engine factory helper ─────────────────────────────────────────────────────

def _make_engine(url: str, *, is_read_replica: bool = False):
    """Create an async SQLAlchemy engine with settings appropriate for the
    given mode (PgBouncer-aware vs. direct PostgreSQL connection).
    """
    if settings.PGBOUNCER_ENABLED:
        # PgBouncer handles the real connection pool; keep SQLAlchemy pool tiny.
        # pool_pre_ping must be off — PgBouncer doesn't like keepalive pings in
        # transaction-level pooling mode.
        return create_async_engine(
            url,
            echo=settings.DEBUG,
            pool_pre_ping=False,
            pool_size=5,
            max_overflow=0,        # no overflow — PgBouncer queues instead
            pool_recycle=3600,
            pool_timeout=30,
            connect_args={
                # Disable asyncpg prepared statement cache — they don't survive
                # connection handoffs in PgBouncer transaction mode.
                "prepared_statement_cache_size": 0,
            },
        )
    else:
        # Direct connection to PostgreSQL (single-node dev or staging).
        read_extra = {"pool_size": 3, "max_overflow": 5} if is_read_replica else {}
        return create_async_engine(
            url,
            echo=settings.DEBUG,
            pool_pre_ping=True,
            pool_size=read_extra.get("pool_size", 5),
            max_overflow=read_extra.get("max_overflow", 10),
            pool_recycle=1800,
            pool_timeout=30,
        )


# ── Primary write engine ──────────────────────────────────────────────────────
engine = _make_engine(settings.DATABASE_URL)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# ── Read-replica engine ───────────────────────────────────────────────────────
# Falls back to the primary URL when READ_DATABASE_URL is not set.
_read_url = settings.READ_DATABASE_URL or settings.DATABASE_URL

read_engine = _make_engine(_read_url, is_read_replica=True)

ReadAsyncSessionLocal = async_sessionmaker(
    read_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── FastAPI dependencies ──────────────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async write database session.

    Opens a session on the primary engine, yields it to the route handler,
    and automatically commits on success or rolls back on any unhandled
    exception. This ensures every request gets a clean, correctly scoped
    transaction.

    Also sets per-transaction PostgreSQL session variables for:
    - Row-Level Security: ``app.current_user_id`` — drives RLS policies
    - Audit context: carried via ``contextvars`` (set by AuditContextMiddleware)

    Yields:
        AsyncSession: A ready-to-use SQLAlchemy async session.

    Raises:
        Re-raises any exception from the route handler after rollback.
    """
    from app.core.audit_listeners import audit_ip_address, audit_user_id  # noqa: PLC0415
    from app.core.rls import set_rls_context  # noqa: PLC0415

    async with AsyncSessionLocal() as session:
        try:
            # Set RLS + audit context for this transaction.
            # Uses the same contextvars populated by AuditContextMiddleware in main.py.
            await set_rls_context(
                session,
                user_id=audit_user_id.get(),
                ip_address=audit_ip_address.get(),
            )
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_read_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a read-only async database session.

    Routes to the read replica in HA mode (via PgBouncer's readonly pool →
    HAProxy → Patroni replicas). Falls back to the primary when no read
    replica is configured.

    Use this for heavy read queries — analytics, dashboard summaries, large
    list views — to offload the primary and improve write throughput.

    Note: Do NOT issue writes through this session. In HA mode the session
    targets a replica that rejects writes.

    Yields:
        AsyncSession: A ready-to-use SQLAlchemy async session (read-only).
    """
    async with ReadAsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Table creation (development only) ────────────────────────────────────────

async def create_all_tables() -> None:
    """Create all tables (used at startup; migrations preferred in production).

    Issues CREATE TABLE IF NOT EXISTS for every model registered on Base.
    In production, prefer Alembic migrations (``alembic upgrade head``)
    for safe, versioned schema changes.
    """
    from app.models import Base  # noqa: PLC0415 — lazy import avoids circular deps

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
