"""Merge all remaining branch heads into a single linear history.

This migration has no upgrade/downgrade logic — it only serves as a
merge point so that `alembic upgrade head` works without ambiguity.

Revision ID: f0a1b2c3d4e5
Revises: a7b8c9d0e1f2, b2c3d4e5f6g7, b8w9x0y1z2a3, c9f0a1b2c3d4,
         c9x0y1z2a3b4, d0e1f2g3h4i5, e2f3g4h5i6j7, p1q2r3s4t5u6,
         t0n1o2p3q4r5
Create Date: 2026-03-13

"""
from typing import Sequence, Union
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f0a1b2c3d4e5"
down_revision: Union[str, tuple] = (
    "a7b8c9d0e1f2",
    "b2c3d4e5f6g7",
    "b8w9x0y1z2a3",
    "c9f0a1b2c3d4",
    "c9x0y1z2a3b4",
    "d0e1f2g3h4i5",
    "e2f3g4h5i6j7",
    "p1q2r3s4t5u6",
    "t0n1o2p3q4r5",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
