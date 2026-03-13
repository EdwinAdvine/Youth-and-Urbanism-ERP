"""merge_heads_for_analytics_phase1

Revision ID: 229239b3ad5e
Revises: b8w9x0y1z2a3, c9d0e1f2g3h4, e83ee220eb9d
Create Date: 2026-03-13 07:19:29.657531

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '229239b3ad5e'
down_revision: Union[str, None] = ('b8w9x0y1z2a3', 'c9d0e1f2g3h4', 'e83ee220eb9d')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
