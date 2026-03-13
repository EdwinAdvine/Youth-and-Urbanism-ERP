"""Add rating fields to document_templates table.

Revision ID: b8e9f0a1b2c3
Revises: dp1a2b3c4d5e
Create Date: 2026-03-12

Adds:
  - document_templates.rating (Float, default 0.0)
  - document_templates.rating_count (Integer, default 0)
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b8e9f0a1b2c3"
down_revision = "dp1a2b3c4d5e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "document_templates",
        sa.Column("rating", sa.Float(), nullable=False, server_default="0.0"),
    )
    op.add_column(
        "document_templates",
        sa.Column("rating_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("document_templates", "rating_count")
    op.drop_column("document_templates", "rating")
