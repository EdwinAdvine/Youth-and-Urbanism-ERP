"""merge_for_missing_cols

Revision ID: 7ad0bee85d46
Revises: a7b8c9d0e1f2, e2f3g4h5i6j7
Create Date: 2026-03-12 23:34:59.075659

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7ad0bee85d46'
down_revision: Union[str, None] = ('a7b8c9d0e1f2', 'e2f3g4h5i6j7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
