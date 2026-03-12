"""Y&U Teams — Chat & Channels models.

Persistent messaging with channels, threading, reactions, presence,
and deep ERP integration via content_type='card' and 'action' messages.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel, TimestampMixin, UUIDPrimaryKeyMixin


# ── Enums ────────────────────────────────────────────────────────────────────

CHANNEL_TYPES = ("public", "private", "direct", "group", "announcement")
CHANNEL_MEMBER_ROLES = ("owner", "admin", "member")
NOTIFICATION_PREFS = ("all", "mentions", "none")
MESSAGE_CONTENT_TYPES = ("text", "system", "file", "card", "action")


# ── Channel ──────────────────────────────────────────────────────────────────

class Channel(BaseModel):
    """A conversation space: public/private channel, DM, or group chat."""

    __tablename__ = "chat_channels"
    __table_args__ = (
        Index("ix_chat_channels_team", "team_id"),
        Index("ix_chat_channels_type", "channel_type"),
        Index("ix_chat_channels_slug", "team_id", "slug", unique=True),
    )

    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=True,
        comment="Null for DMs and group chats not tied to a team",
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False)
    channel_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="public",
        comment="public | private | direct | group | announcement",
    )
    topic: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="Denormalized for fast channel list sorting",
    )
    message_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Optional ERP entity link (auto-created channels)
    linked_entity_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True,
        comment="e.g. 'project', 'deal', 'ticket' for auto-created channels",
    )
    linked_entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )

    # Relationships
    team = relationship("Team", foreign_keys=[team_id])
    creator = relationship("User", foreign_keys=[created_by])
    members: Mapped[list[ChannelMember]] = relationship(
        "ChannelMember", back_populates="channel", cascade="all, delete-orphan",
    )
    messages: Mapped[list[ChatMessage]] = relationship(
        "ChatMessage", back_populates="channel", cascade="all, delete-orphan",
    )
    tabs: Mapped[list[ChannelTab]] = relationship(
        "ChannelTab", back_populates="channel", cascade="all, delete-orphan",
    )
    pinned_messages: Mapped[list[PinnedMessage]] = relationship(
        "PinnedMessage", back_populates="channel", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Channel id={self.id} name={self.name} type={self.channel_type}>"


# ── ChannelMember ────────────────────────────────────────────────────────────

class ChannelMember(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Membership + preferences for a user in a channel."""

    __tablename__ = "chat_channel_members"
    __table_args__ = (
        UniqueConstraint("channel_id", "user_id"),
        Index("ix_chat_channel_members_user", "user_id"),
    )

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(20), default="member", nullable=False,
        comment="owner | admin | member",
    )
    notifications_pref: Mapped[str] = mapped_column(
        String(20), default="all", nullable=False,
        comment="all | mentions | none",
    )
    last_read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    channel: Mapped[Channel] = relationship("Channel", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])


# ── ChatMessage ──────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    """A single message in a channel, with threading and rich content support."""

    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("ix_chat_messages_channel_created", "channel_id", "created_at"),
        Index("ix_chat_messages_parent", "parent_id"),
        Index("ix_chat_messages_sender", "sender_id"),
    )

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="text",
        comment="text | system | file | card | action",
    )

    # Threading
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True,
        comment="Parent message for threaded replies",
    )
    thread_reply_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="Denormalized count of replies in this thread",
    )
    thread_last_reply_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Rich content (JSONB)
    reactions: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, default=dict,
        comment='{"thumbsup": ["user_id1", "user_id2"], "heart": ["user_id3"]}',
    )
    mentions: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list,
        comment='["user_id1", "user_id2"] or ["@channel", "@here"]',
    )
    attachments: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list,
        comment='[{"file_id": "...", "name": "...", "size": 1234, "mime": "..."}]',
    )
    extra_data: Mapped[dict | None] = mapped_column(
        "metadata", JSON, nullable=True,
        comment="Flexible payload for cards/actions: {action, params, result, status, entity_type, entity_id}",
    )

    # Editing / Deletion
    is_edited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    channel: Mapped[Channel] = relationship("Channel", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])
    parent = relationship("ChatMessage", remote_side="ChatMessage.id", foreign_keys=[parent_id])
    read_receipts: Mapped[list[MessageReadReceipt]] = relationship(
        "MessageReadReceipt", back_populates="message", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ChatMessage id={self.id} channel={self.channel_id} type={self.content_type}>"


# ── MessageReadReceipt ───────────────────────────────────────────────────────

class MessageReadReceipt(Base, UUIDPrimaryKeyMixin):
    """Tracks which users have read which messages."""

    __tablename__ = "chat_message_read_receipts"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id"),
        Index("ix_chat_read_receipts_user", "user_id"),
    )

    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    message: Mapped[ChatMessage] = relationship("ChatMessage", back_populates="read_receipts")
    user = relationship("User", foreign_keys=[user_id])


# ── ChannelTab ───────────────────────────────────────────────────────────────

class ChannelTab(BaseModel):
    """Configurable tab pinned to a channel (files, tasks, wiki, dashboard, etc.)."""

    __tablename__ = "chat_channel_tabs"
    __table_args__ = (
        Index("ix_chat_channel_tabs_channel", "channel_id"),
    )

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False,
    )
    tab_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="files | tasks | notes | wiki | dashboard | form | custom_url",
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    config: Mapped[dict | None] = mapped_column(
        JSON, nullable=True,
        comment="Type-specific config: {folder_id, project_id, url, form_id, ...}",
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    channel: Mapped[Channel] = relationship("Channel", back_populates="tabs")
    creator = relationship("User", foreign_keys=[created_by])


# ── PinnedMessage ────────────────────────────────────────────────────────────

class PinnedMessage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A message pinned to a channel for easy reference."""

    __tablename__ = "chat_pinned_messages"
    __table_args__ = (
        UniqueConstraint("channel_id", "message_id"),
    )

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False,
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False,
    )
    pinned_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    channel: Mapped[Channel] = relationship("Channel", back_populates="pinned_messages")
    message = relationship("ChatMessage", foreign_keys=[message_id])
    pinner = relationship("User", foreign_keys=[pinned_by])


# ── UserBookmark ─────────────────────────────────────────────────────────────

class UserBookmark(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Personal bookmark on a message."""

    __tablename__ = "chat_user_bookmarks"
    __table_args__ = (
        UniqueConstraint("user_id", "message_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False,
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    message = relationship("ChatMessage", foreign_keys=[message_id])
