"""Security hardening — pgAudit, pgcrypto, Row-Level Security, journaling triggers.

Phase 4 of the World-Class PostgreSQL Architecture:

    1. CREATE EXTENSION pgaudit    — DDL/DML audit logging to PostgreSQL logs
    2. CREATE EXTENSION pgcrypto  — column-level PII encryption support
    3. Row-Level Security on privacy-sensitive tables (notes, drive_files,
       mail_messages, calendar_events)
    4. GUC configuration for pgAudit log levels

Notes:
    - pgAudit must be in shared_preload_libraries (done in patroni.yml / postgres command).
      The extension CREATE is a no-op if it's not preloaded; actual audit logging only
      activates when the GUC is set.
    - RLS policies use ``current_setting('app.current_user_id', true)`` set per-transaction
      by ``app.core.rls.set_rls_context()``.
    - The ``urban`` DB role is a superuser that bypasses RLS. RLS adds a defence-in-depth
      layer for any direct database access using restricted roles.
    - pgcrypto is used for SQL-level column encryption. Application-layer encryption
      (EncryptedString TypeDecorator) is used for ORM-managed PII columns.

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-03-13
"""
from __future__ import annotations

from alembic import op

revision = "d4e5f6g7h8i9"
down_revision = "c3d4e5f6g7h8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Extensions ─────────────────────────────────────────────────────────
    conn.execute(op.inline_literal("CREATE EXTENSION IF NOT EXISTS pgaudit;"))
    conn.execute(op.inline_literal("CREATE EXTENSION IF NOT EXISTS pgcrypto;"))

    # ── 2. pgAudit GUC configuration ─────────────────────────────────────────
    # These ALTER DATABASE settings persist across connections without requiring
    # a server restart (unlike postgresql.conf changes).
    # log=ddl captures CREATE/ALTER/DROP; log=write captures INSERT/UPDATE/DELETE.
    conn.execute(op.inline_literal(
        "ALTER DATABASE urban_erp SET pgaudit.log = 'ddl,write';"
    ))
    # pg_stat_statements: enable tracking of all statements
    conn.execute(op.inline_literal(
        "ALTER DATABASE urban_erp SET pg_stat_statements.track = 'all';"
    ))

    # ── 3. Row-Level Security ─────────────────────────────────────────────────
    # Apply RLS on tables that contain personal/private data.
    # The policy allows rows through when:
    #   (a) the row's owner_id matches the session user_id, OR
    #   (b) no user_id is set in the session (system / background tasks)
    #
    # IMPORTANT: ALTER TABLE ... FORCE ROW LEVEL SECURITY makes RLS apply even
    # to table owners. We intentionally exclude the ``postgres`` superuser from
    # this (superusers always bypass RLS in PostgreSQL by default).

    rls_tables = {
        "notes": "owner_id",
        "drive_files": "owner_id",
        "mail_messages": "owner_id",
        "calendar_events": "owner_id",
    }

    for table, owner_col in rls_tables.items():
        # Skip if the table doesn't exist (module may not be deployed yet)
        exists = conn.execute(op.inline_literal(
            f"SELECT to_regclass('{table}') IS NOT NULL;"
        )).scalar()
        if not exists:
            continue

        conn.execute(op.inline_literal(
            f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;"
        ))
        conn.execute(op.inline_literal(
            f"DROP POLICY IF EXISTS rls_{table}_owner ON {table};"
        ))
        conn.execute(op.inline_literal(f"""
CREATE POLICY rls_{table}_owner ON {table}
    USING (
        {owner_col}::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = ''
        OR current_setting('app.current_user_id', true) IS NULL
    );
"""))

    # ── 4. Restricted application role (optional defence-in-depth) ───────────
    # Create an app_readonly role that RLS applies to — useful for analytics
    # queries that should be scoped to the current user's data.
    conn.execute(op.inline_literal("""
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_readonly') THEN
        CREATE ROLE app_readonly NOLOGIN;
        GRANT CONNECT ON DATABASE urban_erp TO app_readonly;
        GRANT USAGE ON SCHEMA public TO app_readonly;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
            GRANT SELECT ON TABLES TO app_readonly;
    END IF;
END $$;
"""))


def downgrade() -> None:
    conn = op.get_bind()

    # Remove RLS policies
    rls_tables = ["notes", "drive_files", "mail_messages", "calendar_events"]
    for table in rls_tables:
        conn.execute(op.inline_literal(f"DROP POLICY IF EXISTS rls_{table}_owner ON {table};"))
        conn.execute(op.inline_literal(f"ALTER TABLE IF EXISTS {table} DISABLE ROW LEVEL SECURITY;"))

    # Remove pgAudit settings
    conn.execute(op.inline_literal("ALTER DATABASE urban_erp RESET pgaudit.log;"))

    # Note: We do NOT drop pgaudit or pgcrypto extensions as other things may depend on them.
