"""merge_all_heads

Revision ID: 313bef8b4e75
Revises: 229239b3ad5e, b8e9f0a1b2c3
Create Date: 2026-03-13 07:24:12.627171

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '313bef8b4e75'
down_revision: Union[str, None] = ('229239b3ad5e', 'b8e9f0a1b2c3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
