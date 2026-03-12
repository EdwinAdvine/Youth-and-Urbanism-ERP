"""Y&U Teams — Extended Chat models (Phase 2-3).

Slash commands, webhooks, call sessions, channel templates, shared channels,
retention policies, DLP rules, chat audit logs, live events, and decisions.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
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


# ── Slash Commands ────────────────────────────────────────────────────────────

class SlashCommand(BaseModel):
    """Registry entry for a slash command (/task, /ask, /approve, etc.)."""

    __tablename__ = "chat_slash_commands"
    __table_args__ = (
        UniqueConstraint("command"),
        Index("ix_chat_slash_commands_category", "category"),
    )

    command: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Command name without slash, e.g. 'task', 'ask', 'approve'",
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    usage: Mapped[str | None] = mapped_column(
        String(200), nullable=True,
        comment="Usage hint, e.g. '/task <title> @assignee'",
    )
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, default="general",
        comment="general | erp | ai | admin",
    )
    handler_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="builtin",
        comment="builtin | webhook | ai_tool",
    )
    handler_config: Mapped[dict | None] = mapped_column(
        JSON, nullable=True,
        comment="Config for handler: {tool_name, webhook_url, ai_prompt, ...}",
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    required_role: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
        comment="Minimum role required: null=anyone, admin, owner",
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    def __repr__(self) -> str:
        return f"<SlashCommand /{self.command}>"


# ── Webhooks ──────────────────────────────────────────────────────────────────

class IncomingWebhook(BaseModel):
    """Incoming webhook URL that external systems can POST to send messages."""

    __tablename__ = "chat_incoming_webhooks"
    __table_args__ = (
        Index("ix_chat_incoming_webhooks_channel", "channel_id"),
        UniqueConstraint("token"),
    )

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    token: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="Unique token for the webhook URL",
    )
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    channel = relationship("Channel", foreign_keys=[channel_id])
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<IncomingWebhook name={self.name} channel={self.channel_id}>"


class OutgoingWebhook(BaseModel):
    """Outgoing webhook that triggers on channel events and POSTs to external URL."""

    __tablename__ = "chat_outgoing_webhooks"
    __table_args__ = (
        Index("ix_chat_outgoing_webhooks_channel", "channel_id"),
    )

    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=True,
        comment="Null = all channels",
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    target_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    secret: Mapped[str | None] = mapped_column(
        String(200), nullable=True,
        comment="HMAC secret for signature verification",
    )
    trigger_events: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list,
        comment='["message.new", "message.edited", "member.added"]',
    )
    trigger_keywords: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
        comment='["urgent", "escalate"] — trigger on keyword match',
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    last_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    failure_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    channel = relationship("Channel", foreign_keys=[channel_id])
    creator = relationship("User", foreign_keys=[created_by])


# ── Call Sessions ─────────────────────────────────────────────────────────────

class CallSession(BaseModel):
    """1:1 or group call session using ephemeral Jitsi rooms."""

    __tablename__ = "chat_call_sessions"
    __table_args__ = (
        Index("ix_chat_call_sessions_channel", "channel_id"),
        Index("ix_chat_call_sessions_status", "status"),
    )

    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="SET NULL"), nullable=True,
    )
    call_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="audio",
        comment="audio | video",
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ringing",
        comment="ringing | active | ended | missed | declined",
    )
    initiated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    jitsi_room_name: Mapped[str] = mapped_column(String(200), nullable=False)
    jitsi_jwt: Mapped[str | None] = mapped_column(Text, nullable=True)
    participants: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list,
        comment='[{"user_id": "...", "joined_at": "...", "left_at": "..."}]',
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recording_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    channel = relationship("Channel", foreign_keys=[channel_id])
    initiator = relationship("User", foreign_keys=[initiated_by])


# ── Channel Templates ────────────────────────────────────────────────────────

class ChannelTemplate(BaseModel):
    """Predefined channel setup for Engineering, Sales, Support, etc."""

    __tablename__ = "chat_channel_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, default="general",
        comment="engineering | sales | support | hr | general",
    )
    channel_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="public",
    )
    default_topic: Mapped[str | None] = mapped_column(String(500), nullable=True)
    default_tabs: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
        comment='[{"tab_type": "files", "label": "Files"}, {"tab_type": "tasks", "label": "Tasks"}]',
    )
    auto_post_welcome: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Welcome message posted on channel creation",
    )
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )


# ── Shared Channels ──────────────────────────────────────────────────────────

class SharedChannelLink(BaseModel):
    """Links a channel to multiple teams for cross-team sharing."""

    __tablename__ = "chat_shared_channel_links"
    __table_args__ = (
        UniqueConstraint("channel_id", "team_id"),
        Index("ix_chat_shared_channel_links_team", "team_id"),
    )

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False,
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False,
    )
    shared_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    is_accepted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    channel = relationship("Channel", foreign_keys=[channel_id])
    team = relationship("Team", foreign_keys=[team_id])


# ── Meeting Transcription ────────────────────────────────────────────────────

class MeetingTranscript(BaseModel):
    """Transcribed segment from a meeting via Whisper."""

    __tablename__ = "chat_meeting_transcripts"
    __table_args__ = (
        Index("ix_chat_meeting_transcripts_meeting", "meeting_id"),
        Index("ix_chat_meeting_transcripts_speaker", "speaker_id"),
    )

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False,
    )
    speaker_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    speaker_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    start_time: Mapped[float] = mapped_column(
        nullable=False, comment="Seconds from meeting start",
    )
    end_time: Mapped[float] = mapped_column(nullable=False)
    confidence: Mapped[float | None] = mapped_column(nullable=True)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True, default="en")

    speaker = relationship("User", foreign_keys=[speaker_id])


class MeetingAISummary(BaseModel):
    """AI-generated meeting summary with action items."""

    __tablename__ = "chat_meeting_ai_summaries"
    __table_args__ = (
        Index("ix_chat_meeting_ai_summaries_meeting", "meeting_id"),
    )

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False,
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    key_topics: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
        comment='["Budget Discussion", "Q3 Planning", "Hiring Needs"]',
    )
    action_items: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
        comment='[{"text": "...", "assignee_id": "...", "due_date": "...", "task_id": "..."}]',
    )
    decisions: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
        comment='[{"text": "Go with vendor B", "context": "...", "participants": [...]}]',
    )
    chapters: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
        comment='[{"title": "Budget Discussion", "start_time": 120, "end_time": 480}]',
    )
    sentiment: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
        comment="positive | neutral | negative | mixed",
    )
    talk_time_distribution: Mapped[dict | None] = mapped_column(
        JSON, nullable=True,
        comment='{"user_id_1": 45.2, "user_id_2": 32.1} — percentage',
    )
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    generated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )


# ── Whiteboard ────────────────────────────────────────────────────────────────

class Whiteboard(BaseModel):
    """Collaborative whiteboard (tldraw-based) shareable in channels and meetings."""

    __tablename__ = "chat_whiteboards"
    __table_args__ = (
        Index("ix_chat_whiteboards_channel", "channel_id"),
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="SET NULL"), nullable=True,
    )
    meeting_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    state_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
        comment="MinIO URL for tldraw JSON state",
    )
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    channel = relationship("Channel", foreign_keys=[channel_id])
    creator = relationship("User", foreign_keys=[created_by])


# ── Retention & Compliance (Phase 3) ─────────────────────────────────────────

class RetentionPolicy(BaseModel):
    """Message retention policy for channels or teams."""

    __tablename__ = "chat_retention_policies"
    __table_args__ = (
        Index("ix_chat_retention_policies_team", "team_id"),
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=True,
        comment="Null = global policy",
    )
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=True,
        comment="Null = applies to all channels in team",
    )
    retention_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=365,
        comment="Number of days to keep messages. 0 = forever.",
    )
    delete_files: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        comment="Also delete file attachments when purging messages",
    )
    is_legal_hold: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        comment="Legal hold prevents any deletion",
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    last_purge_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )


class DLPRule(BaseModel):
    """Data Loss Prevention rule for chat messages."""

    __tablename__ = "chat_dlp_rules"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pattern_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="regex",
        comment="regex | keyword | ai",
    )
    pattern: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Regex pattern or keyword list (JSON for keyword type)",
    )
    action: Mapped[str] = mapped_column(
        String(20), nullable=False, default="warn",
        comment="warn | block | redact",
    )
    severity: Mapped[str] = mapped_column(
        String(20), nullable=False, default="medium",
        comment="low | medium | high | critical",
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_admins: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    violation_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )


class DLPViolation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Record of a DLP rule violation."""

    __tablename__ = "chat_dlp_violations"
    __table_args__ = (
        Index("ix_chat_dlp_violations_rule", "rule_id"),
        Index("ix_chat_dlp_violations_message", "message_id"),
        Index("ix_chat_dlp_violations_user", "user_id"),
    )

    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_dlp_rules.id", ondelete="CASCADE"), nullable=False,
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="SET NULL"), nullable=True,
    )
    matched_text: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="The text that triggered the rule (may be redacted)",
    )
    action_taken: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="warned | blocked | redacted",
    )
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    rule = relationship("DLPRule", foreign_keys=[rule_id])
    user = relationship("User", foreign_keys=[user_id])


class ChatAuditLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Audit log for all chat actions (message CRUD, member changes, permission changes)."""

    __tablename__ = "chat_audit_logs"
    __table_args__ = (
        Index("ix_chat_audit_logs_actor", "actor_id"),
        Index("ix_chat_audit_logs_channel", "channel_id"),
        Index("ix_chat_audit_logs_action", "action"),
        Index("ix_chat_audit_logs_created", "created_at"),
    )

    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="SET NULL"), nullable=True,
    )
    action: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="message.created | message.edited | message.deleted | member.added | "
                "member.removed | channel.created | channel.archived | permission.changed | ...",
    )
    target_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True,
        comment="message | channel | member | webhook | ...",
    )
    target_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    details: Mapped[dict | None] = mapped_column(
        JSON, nullable=True,
        comment="Action-specific details: old/new values, etc.",
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    actor = relationship("User", foreign_keys=[actor_id])


# ── Live Events (Phase 3) ────────────────────────────────────────────────────

class LiveEvent(BaseModel):
    """Large-audience broadcast event with registration, Q&A, and polls."""

    __tablename__ = "chat_live_events"
    __table_args__ = (
        Index("ix_chat_live_events_status", "status"),
        Index("ix_chat_live_events_start", "start_time"),
    )

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="webinar",
        comment="webinar | town_hall | broadcast",
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft",
        comment="draft | scheduled | live | ended | cancelled",
    )
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    max_attendees: Mapped[int | None] = mapped_column(Integer, nullable=True)
    require_registration: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False,
    )
    jitsi_room_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    recording_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    moderators: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
        comment='["user_id1", "user_id2"]',
    )
    presenters: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
    )
    settings: Mapped[dict | None] = mapped_column(
        JSON, nullable=True,
        comment='{"q_and_a_enabled": true, "polls_enabled": true, "chat_enabled": true, ...}',
    )
    form_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("forms.id", ondelete="SET NULL"), nullable=True,
        comment="Registration form (reuse Forms module)",
    )
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="SET NULL"), nullable=True,
        comment="Auto-created channel for the event",
    )
    organized_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    attendee_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    peak_concurrent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    organizer = relationship("User", foreign_keys=[organized_by])
    channel = relationship("Channel", foreign_keys=[channel_id])


class LiveEventRegistration(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Registration for a live event."""

    __tablename__ = "chat_live_event_registrations"
    __table_args__ = (
        UniqueConstraint("event_id", "user_id"),
        Index("ix_chat_live_event_registrations_event", "event_id"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_live_events.id", ondelete="CASCADE"), nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="registered",
        comment="registered | attended | no_show | cancelled",
    )
    joined_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    left_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    event = relationship("LiveEvent", foreign_keys=[event_id])
    user = relationship("User", foreign_keys=[user_id])


class LiveEventQA(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Q&A item in a live event."""

    __tablename__ = "chat_live_event_qa"
    __table_args__ = (
        Index("ix_chat_live_event_qa_event", "event_id"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_live_events.id", ondelete="CASCADE"), nullable=False,
    )
    asked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    answered_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    is_answered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    upvote_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    upvoters: Mapped[list | None] = mapped_column(JSON, nullable=True)

    event = relationship("LiveEvent", foreign_keys=[event_id])
    asker = relationship("User", foreign_keys=[asked_by])


# ── Decision Memory ──────────────────────────────────────────────────────────

class Decision(BaseModel):
    """AI-detected decision from a chat thread, formally logged."""

    __tablename__ = "chat_decisions"
    __table_args__ = (
        Index("ix_chat_decisions_channel", "channel_id"),
        Index("ix_chat_decisions_entity", "linked_entity_type", "linked_entity_id"),
    )

    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_channels.id", ondelete="SET NULL"), nullable=True,
    )
    thread_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True,
        comment="Root message of the thread where decision was made",
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    participants: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
        comment='["user_id1", "user_id2"]',
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="confirmed",
        comment="draft | confirmed | superseded | revoked",
    )
    linked_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    linked_entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    channel = relationship("Channel", foreign_keys=[channel_id])
    decider = relationship("User", foreign_keys=[decided_by])


# ── Smart Notifications ───────────────────────────────────────────────────────

class NotificationPreference(BaseModel):
    """Per-user notification preferences with AI priority scoring."""

    __tablename__ = "chat_notification_preferences"
    __table_args__ = (
        UniqueConstraint("user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    quiet_hours_start: Mapped[str | None] = mapped_column(
        String(5), nullable=True, comment="HH:MM format, e.g. '22:00'",
    )
    quiet_hours_end: Mapped[str | None] = mapped_column(
        String(5), nullable=True, comment="HH:MM format, e.g. '08:00'",
    )
    digest_frequency: Mapped[str] = mapped_column(
        String(20), nullable=False, default="realtime",
        comment="realtime | hourly | daily | weekly",
    )
    ai_priority_scoring: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        comment="AI learns which notifications user acts on and suppresses low-priority ones",
    )
    suppressed_senders: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
        comment="User IDs to suppress notifications from",
    )
    priority_keywords: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
        comment='["urgent", "deadline", "blocked"] — always notify',
    )

    user = relationship("User", foreign_keys=[user_id])


# ── Teams Analytics ───────────────────────────────────────────────────────────

class TeamsAnalyticsSnapshot(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Daily snapshot of Teams analytics metrics."""

    __tablename__ = "chat_analytics_snapshots"
    __table_args__ = (
        Index("ix_chat_analytics_snapshots_date", "snapshot_date"),
        UniqueConstraint("snapshot_date", "team_id"),
    )

    snapshot_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=True,
        comment="Null = org-wide snapshot",
    )
    messages_sent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reactions_added: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    files_shared: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    meetings_held: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    meeting_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    active_users: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    new_channels: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    calls_made: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_response_time_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    top_channels: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
        comment='[{"channel_id": "...", "name": "...", "messages": 42}]',
    )
    top_users: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
        comment='[{"user_id": "...", "name": "...", "messages": 15}]',
    )
    sentiment_scores: Mapped[dict | None] = mapped_column(
        JSON, nullable=True,
        comment='{"positive": 0.6, "neutral": 0.3, "negative": 0.1}',
    )
