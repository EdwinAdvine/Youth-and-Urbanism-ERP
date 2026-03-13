"""initial_schema_all_models

Revision ID: 13f96502759d
Revises:
Create Date: 2026-03-10 15:52:21.457678

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '13f96502759d'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable required PostgreSQL extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    op.execute('CREATE EXTENSION IF NOT EXISTS btree_gist')
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS hstore')

    # Create all tables from SQLAlchemy models using metadata.create_all.
    # This ensures the schema always matches the model definitions.
    from app.models import Base  # noqa: E402
    from app.models import *  # noqa: E402, F401, F403

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    from app.models import Base  # noqa: E402
    from app.models import *  # noqa: E402, F401, F403

    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind, checkfirst=True)
