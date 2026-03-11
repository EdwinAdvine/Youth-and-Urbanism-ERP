"""projects_members_json_to_jsonb

Revision ID: 9b8c87451538
Revises: c3d4e5f6a7b8
Create Date: 2026-03-10 22:44:00.912826

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b8c87451538'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE projects ALTER COLUMN members TYPE jsonb USING members::jsonb")


def downgrade() -> None:
    op.execute("ALTER TABLE projects ALTER COLUMN members TYPE json USING members::json")
