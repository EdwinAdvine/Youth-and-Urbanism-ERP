"""merge2

Revision ID: 9eb579cb36d8
Revises: 313bef8b4e75, c9f0a1b2c3d4
Create Date: 2026-03-13 07:25:41.234673

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9eb579cb36d8'
down_revision: Union[str, None] = ('313bef8b4e75', 'c9f0a1b2c3d4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
