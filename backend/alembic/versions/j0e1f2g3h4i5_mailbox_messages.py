"""Add mailbox_messages table for built-in mail storage.

Replaces Stalwart IMAP as the message store when USE_STALWART=false.

Revision ID: j0e1f2g3h4i5
Revises: i9d0e1f2g3h4
Create Date: 2026-03-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "j0e1f2g3h4i5"
down_revision = "i9d0e1f2g3h4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mailbox_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("folder", sa.String(100), nullable=False, server_default="INBOX"),
        # Envelope
        sa.Column("from_addr", sa.String(320), nullable=False, server_default=""),
        sa.Column("from_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("to_addrs", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("cc", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("bcc", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("subject", sa.String(998), nullable=False, server_default=""),
        # Body
        sa.Column("body_html", sa.Text, nullable=False, server_default=""),
        sa.Column("body_text", sa.Text, nullable=False, server_default=""),
        # Metadata
        sa.Column("headers", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("attachments", postgresql.JSONB, nullable=False, server_default="[]"),
        # Flags
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_starred", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_draft", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default="false"),
        # Threading
        sa.Column("message_id_header", sa.String(500), nullable=False, server_default=""),
        sa.Column("in_reply_to", sa.String(500), nullable=False, server_default=""),
        sa.Column("references", sa.Text, nullable=False, server_default=""),
        # Timestamps
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        # Labels
        sa.Column("label_ids", postgresql.JSONB, nullable=False, server_default="[]"),
        # Audit timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Composite indexes for common queries
    op.create_index("ix_mailbox_messages_user_folder", "mailbox_messages", ["user_id", "folder"])
    op.create_index("ix_mailbox_messages_user_received", "mailbox_messages", ["user_id", "received_at"])
    op.create_index("ix_mailbox_messages_user_read", "mailbox_messages", ["user_id", "is_read"])
    op.create_index("ix_mailbox_messages_message_id_header", "mailbox_messages", ["message_id_header"])
    op.create_index("ix_mailbox_messages_folder", "mailbox_messages", ["folder"])
    op.create_index("ix_mailbox_messages_received_at", "mailbox_messages", ["received_at"])


def downgrade() -> None:
    op.drop_index("ix_mailbox_messages_received_at", table_name="mailbox_messages")
    op.drop_index("ix_mailbox_messages_folder", table_name="mailbox_messages")
    op.drop_index("ix_mailbox_messages_message_id_header", table_name="mailbox_messages")
    op.drop_index("ix_mailbox_messages_user_read", table_name="mailbox_messages")
    op.drop_index("ix_mailbox_messages_user_received", table_name="mailbox_messages")
    op.drop_index("ix_mailbox_messages_user_folder", table_name="mailbox_messages")
    op.drop_table("mailbox_messages")
