"""Pydantic schemas for Y&U Teams Phase 2-3 features."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Slash Commands ────────────────────────────────────────────────────────────

class SlashCommandCreate(BaseModel):
    command: str = Field(..., min_length=1, max_length=50)
    description: str = Field(..., max_length=500)
    usage: str | None = Field(None, max_length=200)
    category: Literal["general", "erp", "ai", "admin"] = "general"
    handler_type: Literal["builtin", "webhook", "ai_tool"] = "builtin"
    handler_config: dict[str, Any] | None = None
    required_role: str | None = None


class SlashCommandOut(BaseModel):
    id: uuid.UUID
    command: str
    description: str
    usage: str | None = None
    category: str
    handler_type: str
    handler_config: dict[str, Any] | None = None
    is_enabled: bool
    required_role: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Webhooks ──────────────────────────────────────────────────────────────────

class IncomingWebhookCreate(BaseModel):
    channel_id: uuid.UUID
    name: str = Field(..., max_length=200)
    description: str | None = Field(None, max_length=500)
    avatar_url: str | None = None


class IncomingWebhookOut(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID
    name: str
    description: str | None = None
    token: str
    avatar_url: str | None = None
    is_enabled: bool
    usage_count: int
    last_used_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class OutgoingWebhookCreate(BaseModel):
    channel_id: uuid.UUID | None = None
    name: str = Field(..., max_length=200)
    description: str | None = None
    target_url: str = Field(..., max_length=1000)
    secret: str | None = None
    trigger_events: list[str] = Field(default_factory=lambda: ["message.new"])
    trigger_keywords: list[str] | None = None


class OutgoingWebhookOut(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID | None = None
    name: str
    description: str | None = None
    target_url: str
    trigger_events: list[str]
    trigger_keywords: list[str] | None = None
    is_enabled: bool
    failure_count: int
    last_triggered_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class WebhookPayload(BaseModel):
    """Payload format for incoming webhook messages."""
    text: str = Field(..., max_length=50_000)
    username: str | None = None
    icon_url: str | None = None
    attachments: list[dict[str, Any]] | None = None


# ── Call Sessions ─────────────────────────────────────────────────────────────

class CallInitiate(BaseModel):
    channel_id: uuid.UUID
    call_type: Literal["audio", "video"] = "audio"


class CallAction(BaseModel):
    action: Literal["accept", "decline", "end"]


class CallSessionOut(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID | None = None
    call_type: str
    status: str
    initiated_by: uuid.UUID | None = None
    jitsi_room_name: str
    jitsi_jwt: str | None = None
    participants: list[dict[str, Any]]
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Channel Templates ────────────────────────────────────────────────────────

class ChannelTemplateCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = None
    category: str = "general"
    channel_type: str = "public"
    default_topic: str | None = None
    default_tabs: list[dict[str, str]] | None = None
    auto_post_welcome: str | None = None
    icon: str | None = None


class ChannelTemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    category: str
    channel_type: str
    default_topic: str | None = None
    default_tabs: list[dict[str, str]] | None = None
    auto_post_welcome: str | None = None
    icon: str | None = None
    is_system: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Shared Channels ──────────────────────────────────────────────────────────

class SharedChannelCreate(BaseModel):
    channel_id: uuid.UUID
    team_id: uuid.UUID


class SharedChannelOut(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID
    team_id: uuid.UUID
    shared_by: uuid.UUID | None = None
    is_accepted: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Meeting Transcription ────────────────────────────────────────────────────

class TranscriptSegmentOut(BaseModel):
    id: uuid.UUID
    meeting_id: uuid.UUID
    speaker_id: uuid.UUID | None = None
    speaker_name: str | None = None
    text: str
    start_time: float
    end_time: float
    confidence: float | None = None
    language: str | None = None

    model_config = {"from_attributes": True}


class TranscriptOut(BaseModel):
    meeting_id: uuid.UUID
    segments: list[TranscriptSegmentOut]
    total_duration: float | None = None
    language: str | None = None


class MeetingAISummaryOut(BaseModel):
    id: uuid.UUID
    meeting_id: uuid.UUID
    summary: str
    key_topics: list[str] | None = None
    action_items: list[dict[str, Any]] | None = None
    decisions: list[dict[str, Any]] | None = None
    chapters: list[dict[str, Any]] | None = None
    sentiment: str | None = None
    talk_time_distribution: dict[str, float] | None = None
    model_used: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GenerateSummaryRequest(BaseModel):
    meeting_id: uuid.UUID
    include_action_items: bool = True
    include_chapters: bool = True
    include_sentiment: bool = True


# ── Whiteboard ────────────────────────────────────────────────────────────────

class WhiteboardCreate(BaseModel):
    title: str = Field(..., max_length=200)
    channel_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None


class WhiteboardOut(BaseModel):
    id: uuid.UUID
    title: str
    channel_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None
    state_url: str | None = None
    thumbnail_url: str | None = None
    created_by: uuid.UUID | None = None
    is_locked: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Retention & Compliance ────────────────────────────────────────────────────

class RetentionPolicyCreate(BaseModel):
    name: str = Field(..., max_length=200)
    team_id: uuid.UUID | None = None
    channel_id: uuid.UUID | None = None
    retention_days: int = Field(365, ge=0)
    delete_files: bool = False
    is_legal_hold: bool = False


class RetentionPolicyOut(BaseModel):
    id: uuid.UUID
    name: str
    team_id: uuid.UUID | None = None
    channel_id: uuid.UUID | None = None
    retention_days: int
    delete_files: bool
    is_legal_hold: bool
    is_enabled: bool
    last_purge_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DLPRuleCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = None
    pattern_type: Literal["regex", "keyword", "ai"] = "regex"
    pattern: str
    action: Literal["warn", "block", "redact"] = "warn"
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    notify_admins: bool = True


class DLPRuleOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    pattern_type: str
    pattern: str
    action: str
    severity: str
    is_enabled: bool
    notify_admins: bool
    violation_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DLPViolationOut(BaseModel):
    id: uuid.UUID
    rule_id: uuid.UUID
    message_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    channel_id: uuid.UUID | None = None
    matched_text: str | None = None
    action_taken: str
    is_resolved: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatAuditLogOut(BaseModel):
    id: uuid.UUID
    actor_id: uuid.UUID | None = None
    channel_id: uuid.UUID | None = None
    action: str
    target_type: str | None = None
    target_id: uuid.UUID | None = None
    details: dict[str, Any] | None = None
    ip_address: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EDiscoveryQuery(BaseModel):
    query: str | None = None
    channel_ids: list[uuid.UUID] | None = None
    user_ids: list[uuid.UUID] | None = None
    from_date: datetime | None = None
    to_date: datetime | None = None
    include_deleted: bool = False
    limit: int = Field(100, ge=1, le=1000)
    offset: int = Field(0, ge=0)


class EDiscoveryResult(BaseModel):
    messages: list[Any]
    total: int
    export_id: str | None = None


# ── Live Events ───────────────────────────────────────────────────────────────

class LiveEventCreate(BaseModel):
    title: str = Field(..., max_length=300)
    description: str | None = None
    event_type: Literal["webinar", "town_hall", "broadcast"] = "webinar"
    start_time: datetime
    end_time: datetime | None = None
    max_attendees: int | None = None
    require_registration: bool = True
    settings: dict[str, Any] | None = None
    form_id: uuid.UUID | None = None


class LiveEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    max_attendees: int | None = None
    status: Literal["draft", "scheduled", "live", "ended", "cancelled"] | None = None
    settings: dict[str, Any] | None = None


class LiveEventOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None = None
    event_type: str
    status: str
    start_time: datetime
    end_time: datetime | None = None
    max_attendees: int | None = None
    require_registration: bool
    jitsi_room_name: str | None = None
    recording_url: str | None = None
    moderators: list[str] | None = None
    presenters: list[str] | None = None
    settings: dict[str, Any] | None = None
    form_id: uuid.UUID | None = None
    channel_id: uuid.UUID | None = None
    organized_by: uuid.UUID | None = None
    attendee_count: int
    peak_concurrent: int
    created_at: datetime

    model_config = {"from_attributes": True}


class LiveEventQACreate(BaseModel):
    question: str = Field(..., max_length=2000)


class LiveEventQAAnswer(BaseModel):
    answer: str = Field(..., max_length=5000)


class LiveEventQAOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    asked_by: uuid.UUID | None = None
    question: str
    answer: str | None = None
    answered_by: uuid.UUID | None = None
    is_answered: bool
    is_pinned: bool
    upvote_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Decision Memory ──────────────────────────────────────────────────────────

class DecisionCreate(BaseModel):
    channel_id: uuid.UUID | None = None
    thread_id: uuid.UUID | None = None
    title: str = Field(..., max_length=300)
    description: str
    rationale: str | None = None
    participants: list[uuid.UUID] | None = None
    linked_entity_type: str | None = None
    linked_entity_id: uuid.UUID | None = None


class DecisionOut(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID | None = None
    thread_id: uuid.UUID | None = None
    title: str
    description: str
    rationale: str | None = None
    participants: list[str] | None = None
    status: str
    linked_entity_type: str | None = None
    linked_entity_id: uuid.UUID | None = None
    decided_at: datetime
    decided_by: uuid.UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Smart Notifications ───────────────────────────────────────────────────────

class NotificationPrefUpdate(BaseModel):
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None
    digest_frequency: Literal["realtime", "hourly", "daily", "weekly"] | None = None
    ai_priority_scoring: bool | None = None
    suppressed_senders: list[uuid.UUID] | None = None
    priority_keywords: list[str] | None = None


class NotificationPrefOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None
    digest_frequency: str
    ai_priority_scoring: bool
    suppressed_senders: list[str] | None = None
    priority_keywords: list[str] | None = None

    model_config = {"from_attributes": True}


# ── Teams Analytics ───────────────────────────────────────────────────────────

class TeamsAnalyticsOut(BaseModel):
    snapshot_date: datetime
    team_id: uuid.UUID | None = None
    messages_sent: int
    reactions_added: int
    files_shared: int
    meetings_held: int
    meeting_minutes: int
    active_users: int
    new_channels: int
    calls_made: int
    avg_response_time_seconds: int | None = None
    top_channels: list[dict[str, Any]] | None = None
    top_users: list[dict[str, Any]] | None = None
    sentiment_scores: dict[str, float] | None = None

    model_config = {"from_attributes": True}


class TeamsAnalyticsQuery(BaseModel):
    team_id: uuid.UUID | None = None
    from_date: datetime | None = None
    to_date: datetime | None = None
    granularity: Literal["daily", "weekly", "monthly"] = "daily"
