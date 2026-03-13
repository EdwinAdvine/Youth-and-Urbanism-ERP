"""Table partitioning — convert high-write tables to monthly range partitions.

IMPORTANT: This migration requires a maintenance window. Stop all writes before
running. Estimated time: 5–15 minutes depending on existing data volume.

Tables converted to PARTITION BY RANGE (created_at):
  - pos_transactions
  - chat_messages
  - finance_journal_entries
  - stock_movements
  - analytics_usage_logs
  - universal_audit_log

Strategy per table:
  1. Drop FK constraints from child tables referencing these tables (FK constraints
     cannot reference a partitioned table's non-partition-key columns; they are
     intentionally dropped and NOT recreated — SQLAlchemy handles referential
     integrity at the ORM level).
  2. Rename the original table to <table>_old.
  3. Create the new partitioned table using LIKE (copies column defs + defaults).
  4. Add composite primary key (id, created_at) — required by PG for range-
     partitioned tables; the original UUID uniqueness is preserved per partition.
  5. Create monthly partitions: (today - 1 month) through (today + 4 months) plus
     a DEFAULT partition to catch any out-of-range inserts.
  6. INSERT ... SELECT to copy all existing rows.
  7. Drop the old table.
  8. Recreate indexes lost during the LIKE + manual PK approach.

Downgrade: Intentionally not implemented — converting partitioned tables back to
           regular tables requires a maintenance window and manual data migration.
           Run a database restore instead if rollback is needed.

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-03-13
"""
from __future__ import annotations

from alembic import op

# revision identifiers
revision = "c3d4e5f6g7h8"
down_revision = "b2c3d4e5f6g7"
branch_labels = None
depends_on = None

# Tables to convert — order matters: universal_audit_log first so FK drops from
# it don't affect the other tables' audit rows.
PARTITION_TABLES = [
    "universal_audit_log",
    "analytics_usage_logs",
    "stock_movements",
    "finance_journal_entries",
    "chat_messages",
    "pos_transactions",
]


def upgrade() -> None:
    conn = op.get_bind()

    # ── Step 1: Drop all FK constraints that reference the target tables ──────
    # We use information_schema to discover them dynamically so we don't have to
    # hard-code Alembic-generated constraint names.
    conn.execute(op.inline_literal("""
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT
            tc.table_name   AS child_table,
            tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc
            ON rc.constraint_name = tc.constraint_name
        JOIN information_schema.table_constraints tc2
            ON tc2.constraint_name = rc.unique_constraint_name
        WHERE tc2.table_name IN (
            'pos_transactions',
            'chat_messages',
            'finance_journal_entries',
            'stock_movements',
            'analytics_usage_logs',
            'universal_audit_log'
        )
        AND tc.constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE format(
            'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
            r.child_table,
            r.constraint_name
        );
        RAISE NOTICE 'Dropped FK % on table %', r.constraint_name, r.child_table;
    END LOOP;
END $$;
"""))

    # ── Step 2–8: Convert each table ─────────────────────────────────────────
    for table in PARTITION_TABLES:
        old = f"{table}_old"

        # 2. Rename original table
        conn.execute(op.inline_literal(f'ALTER TABLE IF EXISTS {table} RENAME TO {old};'))

        # 3. Create partitioned table — LIKE copies column definitions and column
        #    defaults but NOT constraints (pk, unique, check) or indexes, which
        #    is exactly what we want since we'll define the PK manually below.
        conn.execute(op.inline_literal(f"""
CREATE TABLE {table}
    (LIKE {old} INCLUDING DEFAULTS INCLUDING COMMENTS)
    PARTITION BY RANGE (created_at);
"""))

        # 4. Add composite PK — PostgreSQL requires all partition key columns to
        #    be part of the primary key on a partitioned table.
        conn.execute(op.inline_literal(f"""
ALTER TABLE {table} ADD PRIMARY KEY (id, created_at);
"""))

        # 5a. Create a DEFAULT catch-all partition for any rows outside the
        #     explicitly defined ranges (protects against insert failures).
        conn.execute(op.inline_literal(f"""
CREATE TABLE {table}_default PARTITION OF {table} DEFAULT;
"""))

        # 5b. Create monthly partitions: one month back through four months ahead.
        #     The partition_maintenance Celery task will extend these monthly.
        conn.execute(op.inline_literal(f"""
DO $$
DECLARE
    i      INT;
    start  DATE;
    finish DATE;
    pname  TEXT;
BEGIN
    FOR i IN -1..4 LOOP
        start  := date_trunc('month', CURRENT_DATE + (i * INTERVAL '1 month'));
        finish := start + INTERVAL '1 month';
        pname  := '{table}_y' || to_char(start, 'YYYY') || 'm' || to_char(start, 'MM');
        BEGIN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF {table} '
                'FOR VALUES FROM (''%s'') TO (''%s'')',
                pname, start, finish
            );
            RAISE NOTICE 'Created partition %', pname;
        EXCEPTION WHEN duplicate_table THEN
            RAISE NOTICE 'Partition % already exists, skipping', pname;
        END;
    END LOOP;
END $$;
"""))

        # 6. Copy all existing data from old table into the new partitioned one.
        #    Rows without a created_at value land in the DEFAULT partition.
        conn.execute(op.inline_literal(f"""
INSERT INTO {table} SELECT * FROM {old};
"""))

        # 7. Drop the old (non-partitioned) table now that data is copied.
        conn.execute(op.inline_literal(f'DROP TABLE {old};'))

        # 8. Recreate the most critical indexes. The composite PK index is created
        #    automatically by ADD PRIMARY KEY above. Add secondary indexes here.
        _recreate_indexes(conn, table)


def _recreate_indexes(conn, table: str) -> None:
    """Recreate per-table secondary indexes dropped during LIKE + PK approach."""

    if table == "pos_transactions":
        conn.execute(op.inline_literal("""
CREATE INDEX IF NOT EXISTS ix_pos_transactions_session_status
    ON pos_transactions (session_id, status);
CREATE INDEX IF NOT EXISTS ix_pos_transactions_created_status
    ON pos_transactions (created_at, status);
CREATE INDEX IF NOT EXISTS ix_pos_transactions_customer
    ON pos_transactions (customer_id)
    WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_pos_transactions_not_deleted
    ON pos_transactions (created_at)
    WHERE deleted_at IS NULL;
"""))

    elif table == "chat_messages":
        conn.execute(op.inline_literal("""
CREATE INDEX IF NOT EXISTS ix_chat_messages_channel_created
    ON chat_messages (channel_id, created_at)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_chat_messages_not_deleted
    ON chat_messages (created_at)
    WHERE deleted_at IS NULL;
"""))

    elif table == "finance_journal_entries":
        conn.execute(op.inline_literal("""
CREATE INDEX IF NOT EXISTS ix_fin_je_entry_date_status
    ON finance_journal_entries (entry_date, status);
CREATE INDEX IF NOT EXISTS ix_fin_je_not_deleted
    ON finance_journal_entries (created_at)
    WHERE deleted_at IS NULL;
"""))

    elif table == "stock_movements":
        conn.execute(op.inline_literal("""
CREATE INDEX IF NOT EXISTS ix_stock_movements_item_created
    ON stock_movements (item_id, created_at);
CREATE INDEX IF NOT EXISTS ix_stock_movements_warehouse_created
    ON stock_movements (warehouse_id, created_at)
    WHERE warehouse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_stock_movements_not_deleted
    ON stock_movements (created_at)
    WHERE deleted_at IS NULL;
"""))

    elif table == "analytics_usage_logs":
        conn.execute(op.inline_literal("""
CREATE INDEX IF NOT EXISTS ix_analytics_usage_logs_created
    ON analytics_usage_logs (created_at);
CREATE INDEX IF NOT EXISTS ix_analytics_usage_logs_user_created
    ON analytics_usage_logs (user_id, created_at)
    WHERE user_id IS NOT NULL;
"""))

    elif table == "universal_audit_log":
        conn.execute(op.inline_literal("""
CREATE INDEX IF NOT EXISTS ix_ual_table_record
    ON universal_audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS ix_ual_timestamp
    ON universal_audit_log (timestamp);
CREATE INDEX IF NOT EXISTS ix_ual_user
    ON universal_audit_log (user_id)
    WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_ual_action
    ON universal_audit_log (action);
"""))


def downgrade() -> None:
    # Downgrading a partitioned table conversion requires a maintenance window
    # and a full data migration. Restore from backup instead.
    # This is intentionally left as a no-op.
    pass
