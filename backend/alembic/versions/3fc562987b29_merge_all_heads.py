"""merge_all_heads

Revision ID: 3fc562987b29
Revises: a91c063e79a0, z6u7v8w9x0y1
Create Date: 2026-03-12 23:12:16.035234

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3fc562987b29'
down_revision: Union[str, None] = ('a91c063e79a0', 'z6u7v8w9x0y1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
