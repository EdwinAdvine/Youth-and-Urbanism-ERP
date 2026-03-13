"""merge_before_analytics_phase2

Revision ID: 56db987dbfa3
Revises: 84096cfd14c1, d0e1f2g3h4i5
Create Date: 2026-03-13 07:53:12.070599

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '56db987dbfa3'
down_revision: Union[str, None] = ('84096cfd14c1', 'd0e1f2g3h4i5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
