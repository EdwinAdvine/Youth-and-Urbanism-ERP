"""Y&U Teams — Phase 2-3 API endpoints.

Calling, webhooks, slash commands, channel templates, shared channels,
transcription, whiteboards, compliance, live events, decisions, analytics.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.schemas.chat_extended import (
    CallAction,
    CallInitiate,
    CallSessionOut,
    ChannelTemplateCreate,
    ChannelTemplateOut,
    ChatAuditLogOut,
    DecisionCreate,
    DecisionOut,
    DLPRuleCreate,
    DLPRuleOut,
    DLPViolationOut,
    EDiscoveryQuery,
    EDiscoveryResult,
    GenerateSummaryRequest,
    IncomingWebhookCreate,
    IncomingWebhookOut,
    LiveEventCreate,
    LiveEventOut,
    LiveEventQAAnswer,
    LiveEventQACreate,
    LiveEventQAOut,
    LiveEventUpdate,
    MeetingAISummaryOut,
    NotificationPrefOut,
    NotificationPrefUpdate,
    OutgoingWebhookCreate,
    OutgoingWebhookOut,
    RetentionPolicyCreate,
    RetentionPolicyOut,
    SharedChannelCreate,
    SharedChannelOut,
    SlashCommandCreate,
    SlashCommandOut,
    TeamsAnalyticsOut,
    TeamsAnalyticsQuery,
    TranscriptOut,
    TranscriptSegmentOut,
    WebhookPayload,
    WhiteboardCreate,
    WhiteboardOut,
)

router = APIRouter()


# ── Slash Commands ────────────────────────────────────────────────────────────

@router.get("/slash-commands", response_model=list[SlashCommandOut])
async def list_slash_commands(
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import SlashCommand

    result = await db.execute(
        select(SlashCommand).where(SlashCommand.is_enabled.is_(True)).order_by(SlashCommand.command)
    )
    return result.scalars().all()


@router.post("/slash-commands", response_model=SlashCommandOut, status_code=201)
async def create_slash_command(
    data: SlashCommandCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import SlashCommand

    cmd = SlashCommand(**data.model_dump(), created_by=user.id)
    db.add(cmd)
    await db.commit()
    await db.refresh(cmd)
    return cmd


@router.delete("/slash-commands/{command_id}", status_code=204)
async def delete_slash_command(
    command_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import SlashCommand

    await db.execute(delete(SlashCommand).where(SlashCommand.id == command_id))
    await db.commit()


@router.post("/slash-commands/execute")
async def execute_slash_command(
    command: str,
    args: str = "",
    channel_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    """Execute a slash command and return the result."""
    from app.models.chat_extended import SlashCommand

    result = await db.execute(
        select(SlashCommand).where(
            SlashCommand.command == command.lstrip("/"),
            SlashCommand.is_enabled.is_(True),
        )
    )
    cmd = result.scalar_one_or_none()
    if not cmd:
        raise HTTPException(404, f"Unknown command: /{command}")

    if cmd.handler_type == "builtin":
        return await _execute_builtin_command(cmd.command, args, channel_id, db, user)
    elif cmd.handler_type == "ai_tool":
        tool_name = (cmd.handler_config or {}).get("tool_name", cmd.command)
        return {"type": "ai_tool", "tool_name": tool_name, "args": args}
    else:
        return {"type": "webhook", "status": "dispatched"}


async def _execute_builtin_command(
    command: str, args: str, channel_id: uuid.UUID | None,
    db: AsyncSession, user,
) -> dict:
    """Handle built-in slash commands."""
    from app.models.chat import Channel, ChatMessage

    if command == "task":
        return {"type": "action", "action": "create_task", "title": args, "status": "pending"}
    elif command == "remind":
        return {"type": "action", "action": "create_reminder", "text": args}
    elif command == "poll":
        parts = args.split("|")
        question = parts[0].strip() if parts else args
        options = [p.strip() for p in parts[1:]] if len(parts) > 1 else []
        return {"type": "poll", "question": question, "options": options}
    elif command == "summarize" and channel_id:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.channel_id == channel_id, ChatMessage.is_deleted.is_(False))
            .order_by(ChatMessage.created_at.desc())
            .limit(50)
        )
        result = await db.execute(stmt)
        messages = result.scalars().all()
        text = "\n".join(m.content[:200] for m in reversed(messages))
        return {"type": "ai_summarize", "message_count": len(messages), "text": text[:5000]}
    elif command == "approve":
        return {"type": "erp_action", "action": "approve", "target": args}
    elif command == "escalate":
        return {"type": "erp_action", "action": "escalate", "target": args}
    elif command == "invoice":
        return {"type": "erp_action", "action": "create_invoice", "args": args}
    else:
        return {"type": "unknown", "command": command, "args": args}


# ── Incoming Webhooks ─────────────────────────────────────────────────────────

@router.get("/webhooks/incoming", response_model=list[IncomingWebhookOut])
async def list_incoming_webhooks(
    channel_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import IncomingWebhook

    stmt = select(IncomingWebhook)
    if channel_id:
        stmt = stmt.where(IncomingWebhook.channel_id == channel_id)
    result = await db.execute(stmt.order_by(IncomingWebhook.created_at.desc()))
    return result.scalars().all()


@router.post("/webhooks/incoming", response_model=IncomingWebhookOut, status_code=201)
async def create_incoming_webhook(
    data: IncomingWebhookCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import IncomingWebhook

    token = secrets.token_urlsafe(32)
    webhook = IncomingWebhook(
        **data.model_dump(), token=token, created_by=user.id,
    )
    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)
    return webhook


@router.delete("/webhooks/incoming/{webhook_id}", status_code=204)
async def delete_incoming_webhook(
    webhook_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import IncomingWebhook

    await db.execute(delete(IncomingWebhook).where(IncomingWebhook.id == webhook_id))
    await db.commit()


@router.post("/webhooks/incoming/{token}/send")
async def receive_webhook_message(
    token: str,
    payload: WebhookPayload,
    db: AsyncSession = Depends(DBSession),
):
    """Public endpoint — external systems POST here to send messages."""
    from app.models.chat import Channel, ChatMessage
    from app.models.chat_extended import IncomingWebhook

    result = await db.execute(
        select(IncomingWebhook).where(
            IncomingWebhook.token == token,
            IncomingWebhook.is_enabled.is_(True),
        )
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(404, "Invalid or disabled webhook")

    msg = ChatMessage(
        channel_id=webhook.channel_id,
        sender_id=webhook.created_by,
        content=payload.text,
        content_type="text",
        extra_data={"webhook_name": webhook.name, "webhook_avatar": payload.icon_url},
    )
    db.add(msg)
    webhook.usage_count += 1
    webhook.last_used_at = datetime.now(timezone.utc)

    channel = await db.get(Channel, webhook.channel_id)
    if channel:
        channel.message_count = (channel.message_count or 0) + 1
        channel.last_message_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(msg)

    await event_bus.publish("chat.message.sent", {
        "channel_id": str(webhook.channel_id),
        "message_id": str(msg.id),
    })
    return {"ok": True, "message_id": str(msg.id)}


# ── Outgoing Webhooks ─────────────────────────────────────────────────────────

@router.get("/webhooks/outgoing", response_model=list[OutgoingWebhookOut])
async def list_outgoing_webhooks(
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import OutgoingWebhook

    result = await db.execute(
        select(OutgoingWebhook).order_by(OutgoingWebhook.created_at.desc())
    )
    return result.scalars().all()


@router.post("/webhooks/outgoing", response_model=OutgoingWebhookOut, status_code=201)
async def create_outgoing_webhook(
    data: OutgoingWebhookCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import OutgoingWebhook

    webhook = OutgoingWebhook(**data.model_dump(), created_by=user.id)
    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)
    return webhook


@router.delete("/webhooks/outgoing/{webhook_id}", status_code=204)
async def delete_outgoing_webhook(
    webhook_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import OutgoingWebhook

    await db.execute(delete(OutgoingWebhook).where(OutgoingWebhook.id == webhook_id))
    await db.commit()


# ── Call Sessions ─────────────────────────────────────────────────────────────

@router.post("/calls", response_model=CallSessionOut, status_code=201)
async def initiate_call(
    data: CallInitiate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import CallSession

    room_name = f"urban-call-{uuid.uuid4().hex[:12]}"
    call = CallSession(
        channel_id=data.channel_id,
        call_type=data.call_type,
        status="ringing",
        initiated_by=user.id,
        jitsi_room_name=room_name,
        participants=[{"user_id": str(user.id), "joined_at": datetime.now(timezone.utc).isoformat()}],
    )
    db.add(call)
    await db.commit()
    await db.refresh(call)

    await event_bus.publish("chat.call.initiated", {
        "call_id": str(call.id),
        "channel_id": str(data.channel_id),
        "call_type": data.call_type,
        "initiated_by": str(user.id),
        "jitsi_room_name": room_name,
    })
    return call


@router.put("/calls/{call_id}", response_model=CallSessionOut)
async def update_call(
    call_id: uuid.UUID,
    data: CallAction,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import CallSession

    call = await db.get(CallSession, call_id)
    if not call:
        raise HTTPException(404, "Call not found")

    now = datetime.now(timezone.utc)
    if data.action == "accept":
        call.status = "active"
        call.started_at = now
        participants = call.participants or []
        participants.append({"user_id": str(user.id), "joined_at": now.isoformat()})
        call.participants = participants
    elif data.action == "decline":
        call.status = "declined"
        call.ended_at = now
    elif data.action == "end":
        call.status = "ended"
        call.ended_at = now
        if call.started_at:
            call.duration_seconds = int((now - call.started_at).total_seconds())

    await db.commit()
    await db.refresh(call)

    await event_bus.publish("chat.call.updated", {
        "call_id": str(call.id),
        "status": call.status,
        "action": data.action,
        "user_id": str(user.id),
    })
    return call


@router.get("/calls/active", response_model=list[CallSessionOut])
async def list_active_calls(
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import CallSession

    result = await db.execute(
        select(CallSession).where(CallSession.status.in_(["ringing", "active"]))
    )
    return result.scalars().all()


# ── Channel Templates ────────────────────────────────────────────────────────

@router.get("/channel-templates", response_model=list[ChannelTemplateOut])
async def list_channel_templates(
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import ChannelTemplate

    result = await db.execute(select(ChannelTemplate).order_by(ChannelTemplate.name))
    return result.scalars().all()


@router.post("/channel-templates", response_model=ChannelTemplateOut, status_code=201)
async def create_channel_template(
    data: ChannelTemplateCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import ChannelTemplate

    template = ChannelTemplate(**data.model_dump(), created_by=user.id)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/channel-templates/{template_id}", status_code=204)
async def delete_channel_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import ChannelTemplate

    await db.execute(delete(ChannelTemplate).where(ChannelTemplate.id == template_id))
    await db.commit()


@router.post("/channel-templates/{template_id}/apply")
async def apply_channel_template(
    template_id: uuid.UUID,
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    """Apply a template to an existing channel (adds tabs, sets topic, posts welcome)."""
    from app.models.chat import Channel, ChannelTab, ChatMessage
    from app.models.chat_extended import ChannelTemplate

    template = await db.get(ChannelTemplate, template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(404, "Channel not found")

    if template.default_topic and not channel.topic:
        channel.topic = template.default_topic

    if template.default_tabs:
        for i, tab_conf in enumerate(template.default_tabs):
            tab = ChannelTab(
                channel_id=channel_id,
                tab_type=tab_conf.get("tab_type", "custom_url"),
                label=tab_conf.get("label", f"Tab {i+1}"),
                config=tab_conf.get("config"),
                position=i,
                created_by=user.id,
            )
            db.add(tab)

    if template.auto_post_welcome:
        msg = ChatMessage(
            channel_id=channel_id,
            sender_id=None,
            content=template.auto_post_welcome,
            content_type="system",
        )
        db.add(msg)

    await db.commit()
    return {"status": "applied", "template": template.name}


# ── Shared Channels ──────────────────────────────────────────────────────────

@router.post("/shared-channels", response_model=SharedChannelOut, status_code=201)
async def share_channel(
    data: SharedChannelCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import SharedChannelLink

    link = SharedChannelLink(
        channel_id=data.channel_id,
        team_id=data.team_id,
        shared_by=user.id,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


@router.put("/shared-channels/{link_id}/accept")
async def accept_shared_channel(
    link_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import SharedChannelLink

    link = await db.get(SharedChannelLink, link_id)
    if not link:
        raise HTTPException(404, "Shared channel link not found")
    link.is_accepted = True
    await db.commit()
    return {"status": "accepted"}


@router.get("/shared-channels", response_model=list[SharedChannelOut])
async def list_shared_channels(
    team_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import SharedChannelLink

    stmt = select(SharedChannelLink)
    if team_id:
        stmt = stmt.where(SharedChannelLink.team_id == team_id)
    result = await db.execute(stmt)
    return result.scalars().all()


# ── Meeting Transcription ────────────────────────────────────────────────────

@router.get("/meetings/{meeting_id}/transcript", response_model=TranscriptOut)
async def get_meeting_transcript(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import MeetingTranscript

    result = await db.execute(
        select(MeetingTranscript)
        .where(MeetingTranscript.meeting_id == meeting_id)
        .order_by(MeetingTranscript.start_time)
    )
    segments = result.scalars().all()
    total_duration = max((s.end_time for s in segments), default=0) if segments else 0

    return TranscriptOut(
        meeting_id=meeting_id,
        segments=[TranscriptSegmentOut.model_validate(s) for s in segments],
        total_duration=total_duration,
    )


@router.post("/meetings/{meeting_id}/transcribe")
async def start_transcription(
    meeting_id: uuid.UUID,
    _user=Depends(CurrentUser),
):
    """Kick off async transcription via Celery task."""
    await event_bus.publish("chat.meeting.transcribe", {
        "meeting_id": str(meeting_id),
    })
    return {"status": "transcription_started", "meeting_id": str(meeting_id)}


@router.get("/meetings/{meeting_id}/summary", response_model=MeetingAISummaryOut | None)
async def get_meeting_summary(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import MeetingAISummary

    result = await db.execute(
        select(MeetingAISummary).where(MeetingAISummary.meeting_id == meeting_id)
    )
    return result.scalar_one_or_none()


@router.post("/meetings/{meeting_id}/generate-summary", response_model=dict)
async def generate_meeting_summary(
    meeting_id: uuid.UUID,
    data: GenerateSummaryRequest | None = None,
    _user=Depends(CurrentUser),
):
    """Trigger AI summary generation via Celery task."""
    await event_bus.publish("chat.meeting.summarize", {
        "meeting_id": str(meeting_id),
        "include_action_items": data.include_action_items if data else True,
        "include_chapters": data.include_chapters if data else True,
        "include_sentiment": data.include_sentiment if data else True,
    })
    return {"status": "summary_generation_started", "meeting_id": str(meeting_id)}


# ── Whiteboards ───────────────────────────────────────────────────────────────

@router.get("/whiteboards", response_model=list[WhiteboardOut])
async def list_whiteboards(
    channel_id: uuid.UUID | None = None,
    meeting_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import Whiteboard

    stmt = select(Whiteboard)
    if channel_id:
        stmt = stmt.where(Whiteboard.channel_id == channel_id)
    if meeting_id:
        stmt = stmt.where(Whiteboard.meeting_id == meeting_id)
    result = await db.execute(stmt.order_by(Whiteboard.created_at.desc()))
    return result.scalars().all()


@router.post("/whiteboards", response_model=WhiteboardOut, status_code=201)
async def create_whiteboard(
    data: WhiteboardCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import Whiteboard

    wb = Whiteboard(**data.model_dump(), created_by=user.id)
    db.add(wb)
    await db.commit()
    await db.refresh(wb)
    return wb


@router.put("/whiteboards/{whiteboard_id}", response_model=WhiteboardOut)
async def update_whiteboard(
    whiteboard_id: uuid.UUID,
    state_url: str | None = None,
    thumbnail_url: str | None = None,
    is_locked: bool | None = None,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import Whiteboard

    wb = await db.get(Whiteboard, whiteboard_id)
    if not wb:
        raise HTTPException(404, "Whiteboard not found")
    if state_url is not None:
        wb.state_url = state_url
    if thumbnail_url is not None:
        wb.thumbnail_url = thumbnail_url
    if is_locked is not None:
        wb.is_locked = is_locked
    await db.commit()
    await db.refresh(wb)
    return wb


@router.delete("/whiteboards/{whiteboard_id}", status_code=204)
async def delete_whiteboard(
    whiteboard_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import Whiteboard

    await db.execute(delete(Whiteboard).where(Whiteboard.id == whiteboard_id))
    await db.commit()


# ── Retention Policies ────────────────────────────────────────────────────────

@router.get("/compliance/retention", response_model=list[RetentionPolicyOut])
async def list_retention_policies(
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import RetentionPolicy

    result = await db.execute(select(RetentionPolicy).order_by(RetentionPolicy.name))
    return result.scalars().all()


@router.post("/compliance/retention", response_model=RetentionPolicyOut, status_code=201)
async def create_retention_policy(
    data: RetentionPolicyCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import RetentionPolicy

    policy = RetentionPolicy(**data.model_dump(), created_by=user.id)
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return policy


@router.put("/compliance/retention/{policy_id}", response_model=RetentionPolicyOut)
async def update_retention_policy(
    policy_id: uuid.UUID,
    data: RetentionPolicyCreate,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import RetentionPolicy

    policy = await db.get(RetentionPolicy, policy_id)
    if not policy:
        raise HTTPException(404, "Policy not found")
    for k, v in data.model_dump().items():
        setattr(policy, k, v)
    await db.commit()
    await db.refresh(policy)
    return policy


@router.delete("/compliance/retention/{policy_id}", status_code=204)
async def delete_retention_policy(
    policy_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import RetentionPolicy

    await db.execute(delete(RetentionPolicy).where(RetentionPolicy.id == policy_id))
    await db.commit()


# ── DLP Rules ─────────────────────────────────────────────────────────────────

@router.get("/compliance/dlp-rules", response_model=list[DLPRuleOut])
async def list_dlp_rules(
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import DLPRule

    result = await db.execute(select(DLPRule).order_by(DLPRule.name))
    return result.scalars().all()


@router.post("/compliance/dlp-rules", response_model=DLPRuleOut, status_code=201)
async def create_dlp_rule(
    data: DLPRuleCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import DLPRule

    rule = DLPRule(**data.model_dump(), created_by=user.id)
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.put("/compliance/dlp-rules/{rule_id}/toggle")
async def toggle_dlp_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import DLPRule

    rule = await db.get(DLPRule, rule_id)
    if not rule:
        raise HTTPException(404, "DLP rule not found")
    rule.is_enabled = not rule.is_enabled
    await db.commit()
    return {"is_enabled": rule.is_enabled}


@router.delete("/compliance/dlp-rules/{rule_id}", status_code=204)
async def delete_dlp_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import DLPRule

    await db.execute(delete(DLPRule).where(DLPRule.id == rule_id))
    await db.commit()


@router.get("/compliance/dlp-violations", response_model=list[DLPViolationOut])
async def list_dlp_violations(
    rule_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    is_resolved: bool | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import DLPViolation

    stmt = select(DLPViolation)
    if rule_id:
        stmt = stmt.where(DLPViolation.rule_id == rule_id)
    if user_id:
        stmt = stmt.where(DLPViolation.user_id == user_id)
    if is_resolved is not None:
        stmt = stmt.where(DLPViolation.is_resolved == is_resolved)
    result = await db.execute(
        stmt.order_by(DLPViolation.created_at.desc()).offset(offset).limit(limit)
    )
    return result.scalars().all()


@router.put("/compliance/dlp-violations/{violation_id}/resolve")
async def resolve_dlp_violation(
    violation_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import DLPViolation

    violation = await db.get(DLPViolation, violation_id)
    if not violation:
        raise HTTPException(404, "Violation not found")
    violation.is_resolved = True
    violation.resolved_by = user.id
    await db.commit()
    return {"status": "resolved"}


# ── Chat Audit Log ────────────────────────────────────────────────────────────

@router.get("/compliance/audit-logs", response_model=list[ChatAuditLogOut])
async def list_chat_audit_logs(
    channel_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
    action: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import ChatAuditLog

    stmt = select(ChatAuditLog)
    if channel_id:
        stmt = stmt.where(ChatAuditLog.channel_id == channel_id)
    if actor_id:
        stmt = stmt.where(ChatAuditLog.actor_id == actor_id)
    if action:
        stmt = stmt.where(ChatAuditLog.action == action)
    if from_date:
        stmt = stmt.where(ChatAuditLog.created_at >= from_date)
    if to_date:
        stmt = stmt.where(ChatAuditLog.created_at <= to_date)
    result = await db.execute(
        stmt.order_by(ChatAuditLog.created_at.desc()).offset(offset).limit(limit)
    )
    return result.scalars().all()


# ── eDiscovery ────────────────────────────────────────────────────────────────

@router.post("/compliance/ediscovery", response_model=EDiscoveryResult)
async def ediscovery_search(
    data: EDiscoveryQuery,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat import ChatMessage
    from app.models.user import User

    stmt = select(ChatMessage, User.full_name).outerjoin(
        User, ChatMessage.sender_id == User.id
    )

    if not data.include_deleted:
        stmt = stmt.where(ChatMessage.is_deleted.is_(False))
    if data.query:
        stmt = stmt.where(ChatMessage.content.ilike(f"%{data.query}%"))
    if data.channel_ids:
        stmt = stmt.where(ChatMessage.channel_id.in_(data.channel_ids))
    if data.user_ids:
        stmt = stmt.where(ChatMessage.sender_id.in_(data.user_ids))
    if data.from_date:
        stmt = stmt.where(ChatMessage.created_at >= data.from_date)
    if data.to_date:
        stmt = stmt.where(ChatMessage.created_at <= data.to_date)

    count_result = await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )
    total = count_result.scalar() or 0

    stmt = stmt.order_by(ChatMessage.created_at.desc()).offset(data.offset).limit(data.limit)
    result = await db.execute(stmt)
    rows = result.all()

    messages = []
    for msg, sender_name in rows:
        messages.append({
            "id": str(msg.id),
            "channel_id": str(msg.channel_id),
            "sender_id": str(msg.sender_id) if msg.sender_id else None,
            "sender_name": sender_name,
            "content": msg.content,
            "content_type": msg.content_type,
            "is_edited": msg.is_edited,
            "is_deleted": msg.is_deleted,
            "created_at": msg.created_at.isoformat(),
        })

    return EDiscoveryResult(messages=messages, total=total)


# ── Live Events ───────────────────────────────────────────────────────────────

@router.get("/live-events", response_model=list[LiveEventOut])
async def list_live_events(
    status: str | None = None,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import LiveEvent

    stmt = select(LiveEvent)
    if status:
        stmt = stmt.where(LiveEvent.status == status)
    result = await db.execute(stmt.order_by(LiveEvent.start_time.desc()))
    return result.scalars().all()


@router.post("/live-events", response_model=LiveEventOut, status_code=201)
async def create_live_event(
    data: LiveEventCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import LiveEvent

    room_name = f"urban-live-{uuid.uuid4().hex[:12]}"
    event = LiveEvent(
        **data.model_dump(),
        organized_by=user.id,
        jitsi_room_name=room_name,
        moderators=[str(user.id)],
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


@router.put("/live-events/{event_id}", response_model=LiveEventOut)
async def update_live_event(
    event_id: uuid.UUID,
    data: LiveEventUpdate,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import LiveEvent

    event = await db.get(LiveEvent, event_id)
    if not event:
        raise HTTPException(404, "Live event not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(event, k, v)
    await db.commit()
    await db.refresh(event)
    return event


@router.post("/live-events/{event_id}/register")
async def register_for_live_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import LiveEvent, LiveEventRegistration

    event = await db.get(LiveEvent, event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    if event.max_attendees and event.attendee_count >= event.max_attendees:
        raise HTTPException(400, "Event is full")

    reg = LiveEventRegistration(event_id=event_id, user_id=user.id)
    db.add(reg)
    event.attendee_count += 1
    await db.commit()
    return {"status": "registered"}


@router.post("/live-events/{event_id}/qa", response_model=LiveEventQAOut, status_code=201)
async def ask_question(
    event_id: uuid.UUID,
    data: LiveEventQACreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import LiveEventQA

    qa = LiveEventQA(event_id=event_id, asked_by=user.id, question=data.question)
    db.add(qa)
    await db.commit()
    await db.refresh(qa)
    return qa


@router.put("/live-events/qa/{qa_id}/answer", response_model=LiveEventQAOut)
async def answer_question(
    qa_id: uuid.UUID,
    data: LiveEventQAAnswer,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import LiveEventQA

    qa = await db.get(LiveEventQA, qa_id)
    if not qa:
        raise HTTPException(404, "Q&A item not found")
    qa.answer = data.answer
    qa.answered_by = user.id
    qa.is_answered = True
    await db.commit()
    await db.refresh(qa)
    return qa


@router.get("/live-events/{event_id}/qa", response_model=list[LiveEventQAOut])
async def list_event_qa(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import LiveEventQA

    result = await db.execute(
        select(LiveEventQA)
        .where(LiveEventQA.event_id == event_id)
        .order_by(LiveEventQA.upvote_count.desc(), LiveEventQA.created_at)
    )
    return result.scalars().all()


@router.post("/live-events/qa/{qa_id}/upvote")
async def upvote_question(
    qa_id: uuid.UUID,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import LiveEventQA

    qa = await db.get(LiveEventQA, qa_id)
    if not qa:
        raise HTTPException(404, "Q&A item not found")
    upvoters = qa.upvoters or []
    uid = str(user.id)
    if uid in upvoters:
        upvoters.remove(uid)
        qa.upvote_count = max(0, qa.upvote_count - 1)
    else:
        upvoters.append(uid)
        qa.upvote_count += 1
    qa.upvoters = upvoters
    await db.commit()
    return {"upvote_count": qa.upvote_count}


# ── Decision Memory ──────────────────────────────────────────────────────────

@router.get("/decisions", response_model=list[DecisionOut])
async def list_decisions(
    channel_id: uuid.UUID | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import Decision

    stmt = select(Decision)
    if channel_id:
        stmt = stmt.where(Decision.channel_id == channel_id)
    if search:
        stmt = stmt.where(
            Decision.title.ilike(f"%{search}%") | Decision.description.ilike(f"%{search}%")
        )
    result = await db.execute(
        stmt.order_by(Decision.decided_at.desc()).offset(offset).limit(limit)
    )
    return result.scalars().all()


@router.post("/decisions", response_model=DecisionOut, status_code=201)
async def create_decision(
    data: DecisionCreate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import Decision

    decision = Decision(
        **data.model_dump(),
        decided_by=user.id,
        participants=[str(p) for p in (data.participants or [])],
    )
    db.add(decision)
    await db.commit()
    await db.refresh(decision)
    return decision


@router.put("/decisions/{decision_id}/status")
async def update_decision_status(
    decision_id: uuid.UUID,
    new_status: str,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import Decision

    decision = await db.get(Decision, decision_id)
    if not decision:
        raise HTTPException(404, "Decision not found")
    decision.status = new_status
    await db.commit()
    return {"status": new_status}


# ── Notification Preferences ─────────────────────────────────────────────────

@router.get("/notification-preferences", response_model=NotificationPrefOut | None)
async def get_notification_preferences(
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import NotificationPreference

    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user.id)
    )
    return result.scalar_one_or_none()


@router.put("/notification-preferences", response_model=NotificationPrefOut)
async def update_notification_preferences(
    data: NotificationPrefUpdate,
    db: AsyncSession = Depends(DBSession),
    user=Depends(CurrentUser),
):
    from app.models.chat_extended import NotificationPreference

    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user.id)
    )
    pref = result.scalar_one_or_none()

    if not pref:
        pref = NotificationPreference(user_id=user.id)
        db.add(pref)

    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "suppressed_senders" and v is not None:
            v = [str(uid) for uid in v]
        setattr(pref, k, v)

    await db.commit()
    await db.refresh(pref)
    return pref


# ── Teams Analytics ───────────────────────────────────────────────────────────

@router.get("/analytics", response_model=list[TeamsAnalyticsOut])
async def get_teams_analytics(
    team_id: uuid.UUID | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    from app.models.chat_extended import TeamsAnalyticsSnapshot

    stmt = select(TeamsAnalyticsSnapshot)
    if team_id:
        stmt = stmt.where(TeamsAnalyticsSnapshot.team_id == team_id)
    if from_date:
        stmt = stmt.where(TeamsAnalyticsSnapshot.snapshot_date >= from_date)
    if to_date:
        stmt = stmt.where(TeamsAnalyticsSnapshot.snapshot_date <= to_date)
    result = await db.execute(stmt.order_by(TeamsAnalyticsSnapshot.snapshot_date.desc()).limit(90))
    return result.scalars().all()


@router.get("/analytics/live")
async def get_live_analytics(
    db: AsyncSession = Depends(DBSession),
    _user=Depends(CurrentUser),
):
    """Real-time analytics computed on the fly."""
    from app.models.chat import Channel, ChannelMember, ChatMessage
    from app.models.chat_extended import CallSession

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    messages_today = await db.execute(
        select(func.count()).select_from(ChatMessage).where(
            ChatMessage.created_at >= today_start,
        )
    )
    total_channels = await db.execute(
        select(func.count()).select_from(Channel).where(Channel.is_archived.is_(False))
    )
    total_members = await db.execute(
        select(func.count(func.distinct(ChannelMember.user_id))).select_from(ChannelMember)
    )
    active_calls = await db.execute(
        select(func.count()).select_from(CallSession).where(
            CallSession.status.in_(["ringing", "active"])
        )
    )

    return {
        "messages_today": messages_today.scalar() or 0,
        "total_channels": total_channels.scalar() or 0,
        "total_active_members": total_members.scalar() or 0,
        "active_calls": active_calls.scalar() or 0,
        "timestamp": now.isoformat(),
    }
