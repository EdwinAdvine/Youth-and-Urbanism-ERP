"""merge_pos_and_hr_heads

Revision ID: 3db90a021a2a
Revises: t0n1o2p3q4r5, u1p2q3r4s5t6
Create Date: 2026-03-11 18:48:30.070885

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3db90a021a2a'
down_revision: Union[str, None] = ('t0n1o2p3q4r5', 'u1p2q3r4s5t6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
