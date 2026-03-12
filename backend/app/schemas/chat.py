"""Pydantic schemas for Y&U Teams chat & channels."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Channel ──────────────────────────────────────────────────────────────────

class ChannelCreate(BaseModel):
    team_id: uuid.UUID | None = None
    name: str = Field(..., min_length=1, max_length=200)
    channel_type: Literal["public", "private", "direct", "group", "announcement"] = "public"
    topic: str | None = Field(None, max_length=500)
    description: str | None = None
    member_ids: list[uuid.UUID] = Field(default_factory=list, description="Initial members to add")


class ChannelUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    topic: str | None = Field(None, max_length=500)
    description: str | None = None
    avatar_url: str | None = None


class ChannelMemberAdd(BaseModel):
    user_id: uuid.UUID
    role: Literal["owner", "admin", "member"] = "member"


class ChannelMemberUpdate(BaseModel):
    role: Literal["owner", "admin", "member"] | None = None
    notifications_pref: Literal["all", "mentions", "none"] | None = None
    is_muted: bool | None = None


class ChannelMemberOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    notifications_pref: str
    is_muted: bool
    last_read_at: datetime | None = None
    joined_at: datetime
    # User info (populated via join)
    user_name: str | None = None
    user_email: str | None = None
    user_avatar: str | None = None
    is_bot: bool = False

    model_config = {"from_attributes": True}


class ChannelOut(BaseModel):
    id: uuid.UUID
    team_id: uuid.UUID | None = None
    name: str
    slug: str
    channel_type: str
    topic: str | None = None
    description: str | None = None
    is_archived: bool
    avatar_url: str | None = None
    last_message_at: datetime | None = None
    message_count: int
    created_by: uuid.UUID | None = None
    linked_entity_type: str | None = None
    linked_entity_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    # Computed fields (populated in route)
    unread_count: int = 0
    member_count: int = 0

    model_config = {"from_attributes": True}


class ChannelListOut(BaseModel):
    channels: list[ChannelOut]
    total: int


# ── Messages ─────────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=50_000)
    content_type: Literal["text", "system", "file", "card", "action"] = "text"
    parent_id: uuid.UUID | None = None
    mentions: list[uuid.UUID | str] = Field(default_factory=list)
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] | None = None


class MessageUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=50_000)


class ReactionToggle(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=50)


class SenderOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    avatar_url: str | None = None
    is_bot: bool = False

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID
    sender_id: uuid.UUID | None = None
    content: str
    content_type: str
    parent_id: uuid.UUID | None = None
    thread_reply_count: int = 0
    thread_last_reply_at: datetime | None = None
    reactions: dict[str, list[str]] | None = None
    mentions: list[str] | None = None
    attachments: list[dict[str, Any]] | None = None
    metadata: dict[str, Any] | None = Field(None, validation_alias="extra_data")
    is_edited: bool = False
    is_deleted: bool = False
    edited_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    # Populated via join
    sender: SenderOut | None = None

    model_config = {"from_attributes": True, "populate_by_name": True}


class MessageListOut(BaseModel):
    messages: list[MessageOut]
    has_more: bool = False
    next_cursor: str | None = None


class ThreadOut(BaseModel):
    root_message: MessageOut
    replies: list[MessageOut]
    total_replies: int


# ── Pinned / Bookmarks ──────────────────────────────────────────────────────

class PinnedMessageOut(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID
    message_id: uuid.UUID
    pinned_by: uuid.UUID | None = None
    created_at: datetime
    message: MessageOut | None = None

    model_config = {"from_attributes": True}


class BookmarkCreate(BaseModel):
    message_id: uuid.UUID
    note: str | None = Field(None, max_length=500)


class BookmarkOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    message_id: uuid.UUID
    note: str | None = None
    created_at: datetime
    message: MessageOut | None = None

    model_config = {"from_attributes": True}


# ── Channel Tabs ─────────────────────────────────────────────────────────────

class ChannelTabCreate(BaseModel):
    tab_type: str = Field(..., max_length=50)
    label: str = Field(..., max_length=100)
    config: dict[str, Any] | None = None
    position: int = 0


class ChannelTabOut(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID
    tab_type: str
    label: str
    config: dict[str, Any] | None = None
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Presence ─────────────────────────────────────────────────────────────────

class PresenceUpdate(BaseModel):
    status: Literal["online", "away", "dnd", "offline"] = "online"
    status_message: str | None = Field(None, max_length=200)
    status_emoji: str | None = Field(None, max_length=10)


class PresenceOut(BaseModel):
    user_id: uuid.UUID
    status: str
    status_message: str | None = None
    status_emoji: str | None = None
    last_active: datetime | None = None


# ── Search ───────────────────────────────────────────────────────────────────

class ChatSearchQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    channel_id: uuid.UUID | None = None
    sender_id: uuid.UUID | None = None
    from_date: datetime | None = None
    to_date: datetime | None = None
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)


class ChatSearchResult(BaseModel):
    messages: list[MessageOut]
    total: int


# ── WebSocket Events ────────────────────────────────────────────────────────

class WSMessageNew(BaseModel):
    type: Literal["message.new"] = "message.new"
    channel_id: uuid.UUID
    message: MessageOut


class WSMessageEdited(BaseModel):
    type: Literal["message.edited"] = "message.edited"
    channel_id: uuid.UUID
    message_id: uuid.UUID
    content: str
    edited_at: datetime


class WSMessageDeleted(BaseModel):
    type: Literal["message.deleted"] = "message.deleted"
    channel_id: uuid.UUID
    message_id: uuid.UUID


class WSTyping(BaseModel):
    type: Literal["typing"] = "typing"
    channel_id: uuid.UUID
    user_id: uuid.UUID
    user_name: str


class WSPresenceChanged(BaseModel):
    type: Literal["presence.changed"] = "presence.changed"
    user_id: uuid.UUID
    status: str
    status_message: str | None = None


class WSReactionAdded(BaseModel):
    type: Literal["reaction.added"] = "reaction.added"
    channel_id: uuid.UUID
    message_id: uuid.UUID
    emoji: str
    user_id: uuid.UUID


class WSReactionRemoved(BaseModel):
    type: Literal["reaction.removed"] = "reaction.removed"
    channel_id: uuid.UUID
    message_id: uuid.UUID
    emoji: str
    user_id: uuid.UUID


class WSReadReceipt(BaseModel):
    type: Literal["read_receipt"] = "read_receipt"
    channel_id: uuid.UUID
    user_id: uuid.UUID
    last_read_at: datetime
