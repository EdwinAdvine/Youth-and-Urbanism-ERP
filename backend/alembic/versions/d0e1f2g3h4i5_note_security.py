"""Note security: add user_agent column to note_audit_logs and seed default sensitivity labels.

Revision ID: d0e1f2g3h4i5
Revises: c9d0e1f2g3h4
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d0e1f2g3h4i5"
down_revision = "c9d0e1f2g3h4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # note_audit_logs and note_sensitivity_labels were created in z6u7v8w9x0y1.
    # This migration adds user_agent column (from security model spec) and seeds labels.

    # Add user_agent column to note_audit_logs (if not already present)
    op.add_column(
        "note_audit_logs",
        sa.Column("user_agent", sa.String(500), nullable=True),
    )

    # Seed default sensitivity labels
    op.execute("""
        INSERT INTO note_sensitivity_labels (id, name, level, color, restrictions)
        VALUES
            (gen_random_uuid(), 'Public', 0, '#6b7280', '{}'),
            (gen_random_uuid(), 'Internal', 1, '#3ec9d6', '{}'),
            (gen_random_uuid(), 'Confidential', 2, '#ffa21d', '{"prevent_export": true, "watermark": true}'),
            (gen_random_uuid(), 'Secret', 3, '#ff3a6e', '{"prevent_export": true, "prevent_share": true, "prevent_print": true, "watermark": true}')
        ON CONFLICT (name) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_column("note_audit_logs", "user_agent")
