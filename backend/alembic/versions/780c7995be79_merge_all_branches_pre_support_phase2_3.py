"""merge_all_branches_pre_support_phase2_3

Revision ID: 780c7995be79
Revises: 5bd9287ad70f, sc7v8w9x0y1z2, dp1a2b3c4d5e, fc1a2b3c4d5e, nd1a2b3c4d5e
Create Date: 2026-03-13 07:14:17.840992

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '780c7995be79'
down_revision: Union[str, None] = ('5bd9287ad70f', 'sc7v8w9x0y1z2', 'dp1a2b3c4d5e', 'fc1a2b3c4d5e', 'nd1a2b3c4d5e')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
