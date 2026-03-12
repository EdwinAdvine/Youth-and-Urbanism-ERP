from __future__ import annotations

import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# ── Make sure 'app' is importable ────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings  # noqa: E402

# Import all models so Alembic can detect them
# Importing Base from app.models triggers __init__.py which registers ALL model mappers
from app.models import Base  # noqa: E402, F401 — registers all mappers
from app.models import *  # noqa: E402, F401, F403 — ensure every model is loaded

# ── Alembic Config ────────────────────────────────────────────────────────────
config = context.config

# Allow alembic.ini logging config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url with the one from our settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


# ── Offline migrations ────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    """Generate SQL without a live DB connection."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# ── Online migrations ─────────────────────────────────────────────────────────
def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=False,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against a live async DB connection."""
    connectable = create_async_engine(settings.DATABASE_URL, echo=False)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


# ── Entry point ───────────────────────────────────────────────────────────────
if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
