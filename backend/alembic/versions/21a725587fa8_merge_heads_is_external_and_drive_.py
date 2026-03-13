"""merge_heads_is_external_and_drive_gateway

Revision ID: 21a725587fa8
Revises: 35f2a7a3c58d, b43232670d70
Create Date: 2026-03-13 16:02:12.003213

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '21a725587fa8'
down_revision: Union[str, None] = ('35f2a7a3c58d', 'b43232670d70')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
