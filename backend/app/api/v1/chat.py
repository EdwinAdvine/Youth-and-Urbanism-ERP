"""Y&U Teams — Chat & Channels REST API.

Endpoints for channel CRUD, messaging, threading, reactions, presence,
search, pinning, bookmarks, and channel tabs.
"""

import json
import re
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.chat import (
    Channel,
    ChannelMember,
    ChannelTab,
    ChatMessage,
    MessageReadReceipt,
    PinnedMessage,
    UserBookmark,
)
from app.models.user import User
from app.schemas.chat import (
    BookmarkCreate,
    BookmarkOut,
    ChannelCreate,
    ChannelListOut,
    ChannelMemberAdd,
    ChannelMemberOut,
    ChannelMemberUpdate,
    ChannelOut,
    ChannelTabCreate,
    ChannelTabOut,
    ChannelUpdate,
    ChatSearchQuery,
    ChatSearchResult,
    MessageCreate,
    MessageListOut,
    MessageOut,
    MessageUpdate,
    PinnedMessageOut,
    PresenceOut,
    PresenceUpdate,
    ReactionToggle,
    SenderOut,
    ThreadOut,
)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _slugify(name: str) -> str:
    """Create a URL-safe slug from a channel name."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "channel"


async def _check_channel_membership(
    db: DBSession, channel_id: UUID, user_id: UUID
) -> ChannelMember:
    """Return membership record or raise 403."""
    q = select(ChannelMember).where(
        ChannelMember.channel_id == channel_id,
        ChannelMember.user_id == user_id,
    )
    member = (await db.execute(q)).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this channel")
    return member


async def _enrich_message(msg: ChatMessage, db: DBSession) -> MessageOut:
    """Build MessageOut with sender info."""
    sender = None
    if msg.sender_id:
        user = await db.get(User, msg.sender_id)
        if user:
            sender = SenderOut(
                id=user.id,
                full_name=user.full_name,
                email=user.email,
                avatar_url=user.avatar_url,
                is_bot=getattr(user, "is_bot", False),
            )
    out = MessageOut.model_validate(msg)
    out.sender = sender
    return out


# ── Channel CRUD ─────────────────────────────────────────────────────────────


@router.post("/channels", status_code=status.HTTP_201_CREATED)
async def create_channel(
    body: ChannelCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> ChannelOut:
    """Create a new channel and add creator + initial members."""

    slug = _slugify(body.name)

    # Check slug uniqueness within team
    existing = await db.execute(
        select(Channel).where(
            Channel.team_id == body.team_id,
            Channel.slug == slug,
        )
    )
    if existing.scalar_one_or_none():
        # Append a short suffix
        slug = f"{slug}-{str(current_user.id)[:8]}"

    channel = Channel(
        team_id=body.team_id,
        name=body.name,
        slug=slug,
        channel_type=body.channel_type,
        topic=body.topic,
        description=body.description,
        created_by=current_user.id,
    )
    db.add(channel)
    await db.flush()

    # Add creator as owner
    creator_member = ChannelMember(
        channel_id=channel.id,
        user_id=current_user.id,
        role="owner",
    )
    db.add(creator_member)

    # Add initial members
    for uid in body.member_ids:
        if uid != current_user.id:
            db.add(ChannelMember(
                channel_id=channel.id,
                user_id=uid,
                role="member",
            ))

    # Auto-create default tabs for non-DM channels
    if body.channel_type not in ("direct", "group"):
        db.add(ChannelTab(
            channel_id=channel.id, tab_type="files", label="Files", position=0,
            created_by=current_user.id,
        ))
        db.add(ChannelTab(
            channel_id=channel.id, tab_type="notes", label="Notes", position=1,
            created_by=current_user.id,
        ))

    await db.commit()
    await db.refresh(channel)

    await event_bus.publish("chat.channel.created", {
        "channel_id": str(channel.id),
        "name": channel.name,
        "type": channel.channel_type,
        "created_by": str(current_user.id),
    })

    out = ChannelOut.model_validate(channel)
    out.member_count = 1 + len(body.member_ids)
    return out


@router.get("/channels")
async def list_channels(
    current_user: CurrentUser,
    db: DBSession,
    team_id: UUID | None = Query(None),
    channel_type: str | None = Query(None),
    include_archived: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> ChannelListOut:
    """List channels the current user is a member of."""

    base = (
        select(Channel)
        .join(ChannelMember, ChannelMember.channel_id == Channel.id)
        .where(ChannelMember.user_id == current_user.id)
    )

    if team_id:
        base = base.where(Channel.team_id == team_id)
    if channel_type:
        base = base.where(Channel.channel_type == channel_type)
    if not include_archived:
        base = base.where(Channel.is_archived == False)  # noqa: E712

    total_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = base.order_by(Channel.last_message_at.desc().nullslast(), Channel.created_at.desc()).offset(skip).limit(limit)
    rows = (await db.execute(q)).scalars().all()

    channels = []
    for ch in rows:
        out = ChannelOut.model_validate(ch)
        # Get member count
        mc = await db.execute(
            select(func.count(ChannelMember.id)).where(ChannelMember.channel_id == ch.id)
        )
        out.member_count = mc.scalar_one()
        channels.append(out)

    return ChannelListOut(channels=channels, total=total)


@router.get("/channels/discover")
async def discover_channels(
    current_user: CurrentUser,
    db: DBSession,
    team_id: UUID | None = Query(None),
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> ChannelListOut:
    """Discover public channels the user is NOT yet a member of."""

    member_ids = select(ChannelMember.channel_id).where(
        ChannelMember.user_id == current_user.id
    )
    base = (
        select(Channel)
        .where(
            Channel.channel_type == "public",
            Channel.is_archived == False,  # noqa: E712
            Channel.id.not_in(member_ids),
        )
    )
    if team_id:
        base = base.where(Channel.team_id == team_id)
    if search:
        base = base.where(Channel.name.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (await db.execute(base.offset(skip).limit(limit))).scalars().all()
    channels = [ChannelOut.model_validate(ch) for ch in rows]
    return ChannelListOut(channels=channels, total=total)


@router.get("/channels/{channel_id}")
async def get_channel(
    channel_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> ChannelOut:
    """Get channel details. Must be a member (or channel is public)."""

    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Check access
    if channel.channel_type != "public":
        await _check_channel_membership(db, channel_id, current_user.id)

    out = ChannelOut.model_validate(channel)
    mc = await db.execute(
        select(func.count(ChannelMember.id)).where(ChannelMember.channel_id == channel_id)
    )
    out.member_count = mc.scalar_one()
    return out


@router.put("/channels/{channel_id}")
async def update_channel(
    channel_id: UUID,
    body: ChannelUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> ChannelOut:
    """Update channel name/topic/description. Requires admin or owner role."""

    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    member = await _check_channel_membership(db, channel_id, current_user.id)
    if member.role not in ("owner", "admin") and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Admin or owner role required")

    if body.name is not None:
        channel.name = body.name
        channel.slug = _slugify(body.name)
    if body.topic is not None:
        channel.topic = body.topic
    if body.description is not None:
        channel.description = body.description
    if body.avatar_url is not None:
        channel.avatar_url = body.avatar_url

    await db.commit()
    await db.refresh(channel)
    return ChannelOut.model_validate(channel)


@router.post("/channels/{channel_id}/archive")
async def archive_channel(
    channel_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> ChannelOut:
    """Archive a channel. Requires owner role."""

    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    member = await _check_channel_membership(db, channel_id, current_user.id)
    if member.role != "owner" and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Owner role required")

    channel.is_archived = not channel.is_archived
    await db.commit()
    await db.refresh(channel)
    return ChannelOut.model_validate(channel)


@router.delete("/channels/{channel_id}", status_code=status.HTTP_200_OK)
async def delete_channel(
    channel_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    """Delete a channel. Super admin or channel owner only."""

    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    member = await _check_channel_membership(db, channel_id, current_user.id)
    if member.role != "owner" and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Owner role required")

    await db.delete(channel)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Channel Members ──────────────────────────────────────────────────────────


@router.get("/channels/{channel_id}/members")
async def list_channel_members(
    channel_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[ChannelMemberOut]:
    """List all members of a channel."""

    await _check_channel_membership(db, channel_id, current_user.id)

    q = (
        select(ChannelMember, User)
        .join(User, User.id == ChannelMember.user_id)
        .where(ChannelMember.channel_id == channel_id)
        .order_by(ChannelMember.joined_at)
    )
    rows = (await db.execute(q)).all()

    members = []
    for cm, user in rows:
        out = ChannelMemberOut.model_validate(cm)
        out.user_name = user.full_name
        out.user_email = user.email
        out.user_avatar = user.avatar_url
        out.is_bot = getattr(user, "is_bot", False)
        members.append(out)

    return members


@router.post("/channels/{channel_id}/members", status_code=status.HTTP_201_CREATED)
async def add_channel_member(
    channel_id: UUID,
    body: ChannelMemberAdd,
    current_user: CurrentUser,
    db: DBSession,
) -> ChannelMemberOut:
    """Add a member to a channel."""

    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # For private channels, require admin/owner to add members
    if channel.channel_type in ("private", "announcement"):
        member = await _check_channel_membership(db, channel_id, current_user.id)
        if member.role not in ("owner", "admin") and not current_user.is_superadmin:
            raise HTTPException(status_code=403, detail="Admin role required to add members")

    # Check duplicate
    existing = await db.execute(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id == body.user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a member")

    # Verify user exists
    target_user = await db.get(User, body.user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    cm = ChannelMember(
        channel_id=channel_id,
        user_id=body.user_id,
        role=body.role,
    )
    db.add(cm)
    await db.commit()
    await db.refresh(cm)

    await event_bus.publish("chat.member.added", {
        "channel_id": str(channel_id),
        "user_id": str(body.user_id),
        "added_by": str(current_user.id),
    })

    out = ChannelMemberOut.model_validate(cm)
    out.user_name = target_user.full_name
    out.user_email = target_user.email
    out.user_avatar = target_user.avatar_url
    return out


@router.put("/channels/{channel_id}/members/{user_id}")
async def update_channel_member(
    channel_id: UUID,
    user_id: UUID,
    body: ChannelMemberUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> ChannelMemberOut:
    """Update a member's role or notification preferences."""

    # Updating own prefs is always allowed
    if user_id != current_user.id:
        my_member = await _check_channel_membership(db, channel_id, current_user.id)
        if my_member.role not in ("owner", "admin") and not current_user.is_superadmin:
            raise HTTPException(status_code=403, detail="Admin role required")

    target = await db.execute(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id == user_id,
        )
    )
    cm = target.scalar_one_or_none()
    if not cm:
        raise HTTPException(status_code=404, detail="Member not found")

    if body.role is not None:
        cm.role = body.role
    if body.notifications_pref is not None:
        cm.notifications_pref = body.notifications_pref
    if body.is_muted is not None:
        cm.is_muted = body.is_muted

    await db.commit()
    await db.refresh(cm)
    return ChannelMemberOut.model_validate(cm)


@router.delete("/channels/{channel_id}/members/{user_id}", status_code=status.HTTP_200_OK)
async def remove_channel_member(
    channel_id: UUID,
    user_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    """Remove a member from a channel. Self-leave or admin kick."""

    if user_id != current_user.id:
        member = await _check_channel_membership(db, channel_id, current_user.id)
        if member.role not in ("owner", "admin") and not current_user.is_superadmin:
            raise HTTPException(status_code=403, detail="Admin role required to remove members")

    result = await db.execute(
        delete(ChannelMember).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id == user_id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.post("/channels/{channel_id}/join")
async def join_channel(
    channel_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> ChannelMemberOut:
    """Join a public channel."""

    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if channel.channel_type != "public":
        raise HTTPException(status_code=403, detail="Can only self-join public channels")

    existing = await db.execute(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already a member")

    cm = ChannelMember(
        channel_id=channel_id,
        user_id=current_user.id,
        role="member",
    )
    db.add(cm)
    await db.commit()
    await db.refresh(cm)
    return ChannelMemberOut.model_validate(cm)


# ── Messages ─────────────────────────────────────────────────────────────────


@router.get("/channels/{channel_id}/messages")
async def list_messages(
    channel_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
    before: str | None = Query(None, description="Cursor: ISO datetime for older messages"),
    after: str | None = Query(None, description="Cursor: ISO datetime for newer messages"),
    limit: int = Query(50, ge=1, le=200),
) -> MessageListOut:
    """List messages in a channel with cursor-based pagination."""

    await _check_channel_membership(db, channel_id, current_user.id)

    q = (
        select(ChatMessage)
        .where(
            ChatMessage.channel_id == channel_id,
            ChatMessage.parent_id == None,  # noqa: E711 — top-level only
        )
    )

    if before:
        q = q.where(ChatMessage.created_at < before)
    if after:
        q = q.where(ChatMessage.created_at > after)

    # Order: newest first when paginating backwards, oldest first when forward
    if after:
        q = q.order_by(ChatMessage.created_at.asc()).limit(limit + 1)
    else:
        q = q.order_by(ChatMessage.created_at.desc()).limit(limit + 1)

    rows = list((await db.execute(q)).scalars().all())
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    # Always return in chronological order
    if not after:
        rows.reverse()

    messages = []
    for msg in rows:
        messages.append(await _enrich_message(msg, db))

    next_cursor = None
    if has_more and messages:
        if after:
            next_cursor = messages[-1].created_at.isoformat()
        else:
            next_cursor = messages[0].created_at.isoformat()

    return MessageListOut(messages=messages, has_more=has_more, next_cursor=next_cursor)


@router.post("/channels/{channel_id}/messages", status_code=status.HTTP_201_CREATED)
async def send_message(
    channel_id: UUID,
    body: MessageCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> MessageOut:
    """Send a message in a channel."""

    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    await _check_channel_membership(db, channel_id, current_user.id)

    if channel.is_archived:
        raise HTTPException(status_code=403, detail="Channel is archived")

    # Validate parent if threading
    if body.parent_id:
        parent = await db.get(ChatMessage, body.parent_id)
        if not parent or parent.channel_id != channel_id:
            raise HTTPException(status_code=404, detail="Parent message not found in this channel")

    msg = ChatMessage(
        channel_id=channel_id,
        sender_id=current_user.id,
        content=body.content,
        content_type=body.content_type,
        parent_id=body.parent_id,
        mentions=[str(m) for m in body.mentions] if body.mentions else [],
        attachments=body.attachments or [],
        extra_data=body.metadata,
    )
    db.add(msg)

    # Update channel's last_message_at and message_count
    channel.last_message_at = datetime.now(timezone.utc)
    channel.message_count = channel.message_count + 1

    # Update parent's thread stats
    if body.parent_id and parent:
        parent.thread_reply_count = parent.thread_reply_count + 1
        parent.thread_last_reply_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(msg)

    result = await _enrich_message(msg, db)

    # Publish event for WebSocket fan-out
    await event_bus.publish("chat.message.sent", {
        "channel_id": str(channel_id),
        "message_id": str(msg.id),
        "sender_id": str(current_user.id),
        "sender_name": current_user.full_name,
        "content": body.content[:200],
        "content_type": body.content_type,
        "parent_id": str(body.parent_id) if body.parent_id else None,
        "mentions": [str(m) for m in body.mentions] if body.mentions else [],
    })

    return result


@router.put("/messages/{message_id}")
async def edit_message(
    message_id: UUID,
    body: MessageUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> MessageOut:
    """Edit a message. Only the sender can edit."""

    msg = await db.get(ChatMessage, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the sender can edit")
    if msg.is_deleted:
        raise HTTPException(status_code=400, detail="Cannot edit a deleted message")

    msg.content = body.content
    msg.is_edited = True
    msg.edited_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(msg)

    await event_bus.publish("chat.message.edited", {
        "channel_id": str(msg.channel_id),
        "message_id": str(msg.id),
        "content": body.content[:200],
        "edited_at": msg.edited_at.isoformat(),
    })

    return await _enrich_message(msg, db)


@router.delete("/messages/{message_id}", status_code=status.HTTP_200_OK)
async def delete_message(
    message_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    """Soft-delete a message. Sender or channel admin."""

    msg = await db.get(ChatMessage, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    is_sender = msg.sender_id == current_user.id
    is_admin = False
    if not is_sender:
        member = await _check_channel_membership(db, msg.channel_id, current_user.id)
        is_admin = member.role in ("owner", "admin") or current_user.is_superadmin

    if not is_sender and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorised")

    msg.is_deleted = True
    msg.content = "[Message deleted]"
    msg.deleted_at = datetime.now(timezone.utc)
    msg.attachments = []
    msg.extra_data = None

    await db.commit()

    await event_bus.publish("chat.message.deleted", {
        "channel_id": str(msg.channel_id),
        "message_id": str(msg.id),
    })

    return Response(status_code=status.HTTP_200_OK)


# ── Threading ────────────────────────────────────────────────────────────────


@router.get("/messages/{message_id}/thread")
async def get_thread(
    message_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ThreadOut:
    """Get a message thread (root + replies)."""

    root = await db.get(ChatMessage, message_id)
    if not root:
        raise HTTPException(status_code=404, detail="Message not found")

    await _check_channel_membership(db, root.channel_id, current_user.id)

    q = (
        select(ChatMessage)
        .where(ChatMessage.parent_id == message_id)
        .order_by(ChatMessage.created_at)
        .offset(offset)
        .limit(limit)
    )
    replies = list((await db.execute(q)).scalars().all())

    total_q = select(func.count(ChatMessage.id)).where(ChatMessage.parent_id == message_id)
    total = (await db.execute(total_q)).scalar_one()

    root_out = await _enrich_message(root, db)
    reply_outs = [await _enrich_message(r, db) for r in replies]

    return ThreadOut(root_message=root_out, replies=reply_outs, total_replies=total)


# ── Reactions ────────────────────────────────────────────────────────────────


@router.post("/messages/{message_id}/reactions")
async def toggle_reaction(
    message_id: UUID,
    body: ReactionToggle,
    current_user: CurrentUser,
    db: DBSession,
) -> MessageOut:
    """Add or remove a reaction on a message (toggle)."""

    msg = await db.get(ChatMessage, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    await _check_channel_membership(db, msg.channel_id, current_user.id)

    reactions = dict(msg.reactions or {})
    user_id_str = str(current_user.id)
    emoji = body.emoji

    if emoji in reactions:
        if user_id_str in reactions[emoji]:
            reactions[emoji].remove(user_id_str)
            if not reactions[emoji]:
                del reactions[emoji]
            event_type = "chat.reaction.removed"
        else:
            reactions[emoji].append(user_id_str)
            event_type = "chat.reaction.added"
    else:
        reactions[emoji] = [user_id_str]
        event_type = "chat.reaction.added"

    msg.reactions = reactions
    await db.commit()
    await db.refresh(msg)

    await event_bus.publish(event_type, {
        "channel_id": str(msg.channel_id),
        "message_id": str(msg.id),
        "emoji": emoji,
        "user_id": user_id_str,
    })

    return await _enrich_message(msg, db)


# ── Read Receipts ────────────────────────────────────────────────────────────


@router.post("/channels/{channel_id}/read")
async def mark_channel_read(
    channel_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    """Mark a channel as read up to now."""

    member = await _check_channel_membership(db, channel_id, current_user.id)
    member.last_read_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "ok"}


# ── Typing Indicator ─────────────────────────────────────────────────────────


@router.post("/channels/{channel_id}/typing")
async def send_typing(
    channel_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    """Notify that the user is typing. Published via event bus for WS fanout."""

    await _check_channel_membership(db, channel_id, current_user.id)

    await event_bus.publish("chat.typing", {
        "channel_id": str(channel_id),
        "user_id": str(current_user.id),
        "user_name": current_user.full_name,
    })
    return {"status": "ok"}


# ── Presence ─────────────────────────────────────────────────────────────────


@router.put("/presence")
async def update_presence(
    body: PresenceUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, str]:
    """Update the current user's presence status (stored in Redis)."""
    import redis.asyncio as aioredis
    from app.core.config import settings

    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        presence_data = json.dumps({
            "user_id": str(current_user.id),
            "status": body.status,
            "status_message": body.status_message,
            "status_emoji": body.status_emoji,
            "last_active": datetime.now(timezone.utc).isoformat(),
        })
        await r.set(f"presence:{current_user.id}", presence_data, ex=120)

        await event_bus.publish("chat.presence.changed", {
            "user_id": str(current_user.id),
            "status": body.status,
            "status_message": body.status_message,
        })
    finally:
        await r.close()

    return {"status": "ok"}


@router.get("/presence")
async def get_presence(
    current_user: CurrentUser,
    db: DBSession,
    user_ids: str = Query(..., description="Comma-separated user UUIDs"),
) -> list[PresenceOut]:
    """Get presence for a list of users."""
    import redis.asyncio as aioredis
    from app.core.config import settings

    ids = [uid.strip() for uid in user_ids.split(",") if uid.strip()]
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        results = []
        for uid in ids:
            data = await r.get(f"presence:{uid}")
            if data:
                parsed = json.loads(data)
                results.append(PresenceOut(
                    user_id=parsed["user_id"],
                    status=parsed.get("status", "online"),
                    status_message=parsed.get("status_message"),
                    status_emoji=parsed.get("status_emoji"),
                    last_active=parsed.get("last_active"),
                ))
            else:
                results.append(PresenceOut(user_id=uid, status="offline"))
        return results
    finally:
        await r.close()


# ── Search ───────────────────────────────────────────────────────────────────


@router.get("/search")
async def search_messages(
    current_user: CurrentUser,
    db: DBSession,
    q: str = Query(..., min_length=1, max_length=500),
    channel_id: UUID | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> ChatSearchResult:
    """Full-text search across messages in channels the user belongs to."""

    # Get user's channels
    my_channels = select(ChannelMember.channel_id).where(
        ChannelMember.user_id == current_user.id
    )

    base = (
        select(ChatMessage)
        .where(
            ChatMessage.channel_id.in_(my_channels),
            ChatMessage.is_deleted == False,  # noqa: E712
            ChatMessage.content.ilike(f"%{q}%"),
        )
    )

    if channel_id:
        base = base.where(ChatMessage.channel_id == channel_id)

    total_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(total_q)).scalar_one()

    results = (await db.execute(
        base.order_by(ChatMessage.created_at.desc()).offset(offset).limit(limit)
    )).scalars().all()

    messages = [await _enrich_message(msg, db) for msg in results]
    return ChatSearchResult(messages=messages, total=total)


# ── Pinned Messages ─────────────────────────────────────────────────────────


@router.post("/channels/{channel_id}/pin/{message_id}", status_code=status.HTTP_201_CREATED)
async def pin_message(
    channel_id: UUID,
    message_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> PinnedMessageOut:
    """Pin a message to the channel."""

    member = await _check_channel_membership(db, channel_id, current_user.id)
    msg = await db.get(ChatMessage, message_id)
    if not msg or msg.channel_id != channel_id:
        raise HTTPException(status_code=404, detail="Message not found in this channel")

    existing = await db.execute(
        select(PinnedMessage).where(
            PinnedMessage.channel_id == channel_id,
            PinnedMessage.message_id == message_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Message already pinned")

    pin = PinnedMessage(
        channel_id=channel_id,
        message_id=message_id,
        pinned_by=current_user.id,
    )
    db.add(pin)
    await db.commit()
    await db.refresh(pin)
    return PinnedMessageOut.model_validate(pin)


@router.delete("/channels/{channel_id}/pin/{message_id}", status_code=status.HTTP_200_OK)
async def unpin_message(
    channel_id: UUID,
    message_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    """Unpin a message from the channel."""

    await _check_channel_membership(db, channel_id, current_user.id)
    result = await db.execute(
        delete(PinnedMessage).where(
            PinnedMessage.channel_id == channel_id,
            PinnedMessage.message_id == message_id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Pin not found")
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


@router.get("/channels/{channel_id}/pins")
async def list_pinned_messages(
    channel_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[PinnedMessageOut]:
    """List pinned messages in a channel."""

    await _check_channel_membership(db, channel_id, current_user.id)
    q = (
        select(PinnedMessage)
        .where(PinnedMessage.channel_id == channel_id)
        .order_by(PinnedMessage.created_at.desc())
    )
    rows = (await db.execute(q)).scalars().all()

    results = []
    for pin in rows:
        out = PinnedMessageOut.model_validate(pin)
        msg = await db.get(ChatMessage, pin.message_id)
        if msg:
            out.message = await _enrich_message(msg, db)
        results.append(out)
    return results


# ── Bookmarks ────────────────────────────────────────────────────────────────


@router.post("/bookmarks", status_code=status.HTTP_201_CREATED)
async def create_bookmark(
    body: BookmarkCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> BookmarkOut:
    """Bookmark a message for personal reference."""

    msg = await db.get(ChatMessage, body.message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    await _check_channel_membership(db, msg.channel_id, current_user.id)

    existing = await db.execute(
        select(UserBookmark).where(
            UserBookmark.user_id == current_user.id,
            UserBookmark.message_id == body.message_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already bookmarked")

    bm = UserBookmark(
        user_id=current_user.id,
        message_id=body.message_id,
        note=body.note,
    )
    db.add(bm)
    await db.commit()
    await db.refresh(bm)
    return BookmarkOut.model_validate(bm)


@router.get("/bookmarks")
async def list_bookmarks(
    current_user: CurrentUser,
    db: DBSession,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[BookmarkOut]:
    """List the current user's bookmarked messages."""

    q = (
        select(UserBookmark)
        .where(UserBookmark.user_id == current_user.id)
        .order_by(UserBookmark.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()

    results = []
    for bm in rows:
        out = BookmarkOut.model_validate(bm)
        msg = await db.get(ChatMessage, bm.message_id)
        if msg:
            out.message = await _enrich_message(msg, db)
        results.append(out)
    return results


@router.delete("/bookmarks/{bookmark_id}", status_code=status.HTTP_200_OK)
async def delete_bookmark(
    bookmark_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    """Remove a bookmark."""

    bm = await db.get(UserBookmark, bookmark_id)
    if not bm:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    if bm.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your bookmark")

    await db.delete(bm)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Channel Tabs ─────────────────────────────────────────────────────────────


@router.get("/channels/{channel_id}/tabs")
async def list_tabs(
    channel_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> list[ChannelTabOut]:
    """List tabs for a channel."""

    await _check_channel_membership(db, channel_id, current_user.id)
    q = (
        select(ChannelTab)
        .where(ChannelTab.channel_id == channel_id)
        .order_by(ChannelTab.position)
    )
    rows = (await db.execute(q)).scalars().all()
    return [ChannelTabOut.model_validate(t) for t in rows]


@router.post("/channels/{channel_id}/tabs", status_code=status.HTTP_201_CREATED)
async def create_tab(
    channel_id: UUID,
    body: ChannelTabCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> ChannelTabOut:
    """Add a tab to a channel."""

    member = await _check_channel_membership(db, channel_id, current_user.id)
    if member.role not in ("owner", "admin") and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Admin role required")

    tab = ChannelTab(
        channel_id=channel_id,
        tab_type=body.tab_type,
        label=body.label,
        config=body.config,
        position=body.position,
        created_by=current_user.id,
    )
    db.add(tab)
    await db.commit()
    await db.refresh(tab)
    return ChannelTabOut.model_validate(tab)


@router.delete("/channels/{channel_id}/tabs/{tab_id}", status_code=status.HTTP_200_OK)
async def delete_tab(
    channel_id: UUID,
    tab_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Response:
    """Remove a tab from a channel."""

    member = await _check_channel_membership(db, channel_id, current_user.id)
    if member.role not in ("owner", "admin") and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Admin role required")

    tab = await db.get(ChannelTab, tab_id)
    if not tab or tab.channel_id != channel_id:
        raise HTTPException(status_code=404, detail="Tab not found")

    await db.delete(tab)
    await db.commit()
    return Response(status_code=status.HTTP_200_OK)


# ── Direct Messages Helper ──────────────────────────────────────────────────


@router.post("/dm")
async def get_or_create_dm(
    current_user: CurrentUser,
    db: DBSession,
    user_id: UUID = Query(..., description="The other user's ID"),
) -> ChannelOut:
    """Get or create a DM channel between current user and target user."""

    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")

    # Find existing DM between these two users
    my_dm_channels = (
        select(ChannelMember.channel_id)
        .where(ChannelMember.user_id == current_user.id)
    )
    their_dm_channels = (
        select(ChannelMember.channel_id)
        .where(ChannelMember.user_id == user_id)
    )
    existing_q = (
        select(Channel)
        .where(
            Channel.channel_type == "direct",
            Channel.id.in_(my_dm_channels),
            Channel.id.in_(their_dm_channels),
        )
    )
    existing = (await db.execute(existing_q)).scalar_one_or_none()
    if existing:
        return ChannelOut.model_validate(existing)

    # Create new DM channel
    dm_name = f"DM: {current_user.full_name} & {target.full_name}"
    channel = Channel(
        name=dm_name,
        slug=f"dm-{str(current_user.id)[:8]}-{str(user_id)[:8]}",
        channel_type="direct",
        created_by=current_user.id,
    )
    db.add(channel)
    await db.flush()

    db.add(ChannelMember(channel_id=channel.id, user_id=current_user.id, role="member"))
    db.add(ChannelMember(channel_id=channel.id, user_id=user_id, role="member"))

    await db.commit()
    await db.refresh(channel)

    out = ChannelOut.model_validate(channel)
    out.member_count = 2
    return out
