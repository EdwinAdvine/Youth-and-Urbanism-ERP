"""merge_docs_and_projects_heads

Revision ID: a91c063e79a0
Revises: p1q2r3s4t5u6, w3r4s5t6u7v8
Create Date: 2026-03-12 17:25:52.514545

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a91c063e79a0'
down_revision: Union[str, None] = ('p1q2r3s4t5u6', 'w3r4s5t6u7v8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
