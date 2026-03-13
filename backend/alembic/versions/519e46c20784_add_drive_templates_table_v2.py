"""add_drive_templates_table_v2

Revision ID: 519e46c20784
Revises: 2ddb016ecd56
Create Date: 2026-03-13 08:00:27.990748

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '519e46c20784'
down_revision: Union[str, None] = '2ddb016ecd56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'drive_templates',
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('content_type', sa.String(255), nullable=False),
        sa.Column('minio_key', sa.String(1024), nullable=False, unique=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('thumbnail_key', sa.String(1024), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('variables_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('use_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_drive_templates_created_by', 'drive_templates', ['created_by'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_drive_templates_created_by', table_name='drive_templates')
    op.drop_table('drive_templates')
