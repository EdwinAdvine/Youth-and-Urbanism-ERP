"""Analytics models — dashboards, widgets, saved queries, reports, data alerts."""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ── Dashboard ────────────────────────────────────────────────────────────────
class Dashboard(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """User-created analytics dashboard."""

    __tablename__ = "analytics_dashboards"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    layout: Mapped[dict] = mapped_column(JSON, default=dict)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)

    widgets = relationship(
        "AnalyticsDashboardWidget", back_populates="dashboard", cascade="all, delete-orphan"
    )


# ── DashboardWidget ──────────────────────────────────────────────────────────
class AnalyticsDashboardWidget(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Single widget on a dashboard (chart, KPI card, table, etc.)."""

    __tablename__ = "analytics_dashboard_widgets"

    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_dashboards.id"), nullable=False
    )
    widget_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # line, bar, pie, donut, kpi, table, heatmap, funnel, gauge
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    query_config: Mapped[dict] = mapped_column(JSON, nullable=False)
    position: Mapped[dict] = mapped_column(JSON, default=lambda: {"x": 0, "y": 0})
    size: Mapped[dict] = mapped_column(JSON, default=lambda: {"w": 6, "h": 4})
    settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    dashboard = relationship("Dashboard", back_populates="widgets")


# ── SavedQuery ───────────────────────────────────────────────────────────────
class SavedQuery(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Reusable SQL query saved by a user."""

    __tablename__ = "analytics_saved_queries"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sql_text: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    module: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)


# ── Report ───────────────────────────────────────────────────────────────────
class Report(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Scheduled or one-time report generation config."""

    __tablename__ = "analytics_reports"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    report_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # scheduled, one_time
    schedule: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # cron expression
    query_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_saved_queries.id"), nullable=True
    )
    format: Mapped[str] = mapped_column(
        String(10), default="pdf"
    )  # pdf, csv, xlsx
    recipients: Mapped[list] = mapped_column(JSON, default=list)
    last_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    query = relationship("SavedQuery")


# ── DataAlert ────────────────────────────────────────────────────────────────
class DataAlert(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Threshold-based alert tied to a saved query."""

    __tablename__ = "analytics_data_alerts"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    condition: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # gt, lt, gte, lte, eq, neq, variance_from_goal, pct_change
    threshold: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    query_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_saved_queries.id"), nullable=False
    )
    notify_users: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_triggered: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    query = relationship("SavedQuery")


# ── SemanticModel ────────────────────────────────────────────────────────────
class SemanticModel(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Semantic data model — defines tables, relationships, and measures for BI."""

    __tablename__ = "analytics_semantic_models"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    module: Mapped[str] = mapped_column(String(50), nullable=False)
    tables: Mapped[dict] = mapped_column(JSON, default=dict)
    relationships: Mapped[dict] = mapped_column(JSON, default=dict)
    measures: Mapped[list] = mapped_column(JSON, default=list)
    calculated_columns: Mapped[list] = mapped_column(JSON, default=list)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


# ── DataTransformPipeline ────────────────────────────────────────────────────
class DataTransformPipeline(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Ordered transform steps — Power Query equivalent for ERP data."""

    __tablename__ = "analytics_transform_pipelines"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_table: Mapped[str] = mapped_column(String(200), nullable=False)
    steps: Mapped[list] = mapped_column(JSON, default=list)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)


# ── DashboardBookmark ────────────────────────────────────────────────────────
class DashboardBookmark(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Saved filter/view state for a dashboard."""

    __tablename__ = "analytics_dashboard_bookmarks"

    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_dashboards.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    filter_state: Mapped[dict] = mapped_column(JSON, default=dict)
    visual_states: Mapped[dict] = mapped_column(JSON, default=dict)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    dashboard = relationship("Dashboard")


# ── DashboardVersion ─────────────────────────────────────────────────────────
class DashboardVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Auto-saved version snapshot of a dashboard for history/rollback."""

    __tablename__ = "analytics_dashboard_versions"

    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_dashboards.id"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(nullable=False, default=1)
    layout_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    widgets_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    dashboard = relationship("Dashboard")


# ── Scorecard & Goals ────────────────────────────────────────────────────────
class Scorecard(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Scorecard — hierarchical container for KPI goals."""

    __tablename__ = "analytics_scorecards"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_scorecards.id"), nullable=True
    )
    period: Mapped[str] = mapped_column(String(20), default="quarterly")
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    goals = relationship("AnalyticsGoal", back_populates="scorecard", cascade="all, delete-orphan")


class AnalyticsGoal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Individual KPI goal with target vs actual tracking."""

    __tablename__ = "analytics_goals"

    scorecard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_scorecards.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    metric_query: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    actual_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    status: Mapped[str] = mapped_column(
        String(20), default="on_track"
    )  # on_track, at_risk, behind, exceeded
    unit: Mapped[str] = mapped_column(String(20), default="number")
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    scorecard = relationship("Scorecard", back_populates="goals")
    check_ins = relationship("AnalyticsGoalCheckIn", back_populates="goal", cascade="all, delete-orphan")


class AnalyticsGoalCheckIn(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Periodic check-in entry for a goal."""

    __tablename__ = "analytics_goal_check_ins"

    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_goals.id"), nullable=False
    )
    value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    goal = relationship("AnalyticsGoal", back_populates="check_ins")


# ── Analytics Audit Log ──────────────────────────────────────────────────────
class AnalyticsAuditLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tracks all analytics access — queries, views, exports."""

    __tablename__ = "analytics_audit_log"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    query_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    execution_time_ms: Mapped[int | None] = mapped_column(nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)


# ── Analytics Insight (Proactive AI) ─────────────────────────────────────────
class AnalyticsInsight(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """AI-discovered insight from proactive KPI scanning."""

    __tablename__ = "analytics_insights"

    insight_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # anomaly, trend_change, correlation, forecast
    module: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(
        String(20), default="info"
    )  # info, warning, critical
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    dismissed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


# ── DashboardRLS ──────────────────────────────────────────────────────────────
class DashboardRLS(Base):
    """Row-Level Security rules — filter injected into queries based on user role."""

    __tablename__ = "dashboard_rls"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_dashboards.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str | None] = mapped_column(sa.String, nullable=True)         # applies to this role (None = all roles)
    user_id: Mapped[str | None] = mapped_column(sa.String, nullable=True)       # applies to specific user
    field: Mapped[str] = mapped_column(sa.String, nullable=False)               # e.g. "department_id"
    operator: Mapped[str] = mapped_column(sa.String, default="eq")              # eq, in, gt, lt
    value_template: Mapped[str] = mapped_column(sa.String, nullable=False)      # "{current_user.department_id}" or literal
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=func.now())


# ── AnalyticsUsageLog ─────────────────────────────────────────────────────────
class AnalyticsUsageLog(Base):
    """Tracks dashboard views, widget clicks, query executions."""

    __tablename__ = "analytics_usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str | None] = mapped_column(sa.String, nullable=True)
    resource_type: Mapped[str] = mapped_column(sa.String, nullable=False)       # "dashboard", "widget", "query", "copilot"
    resource_id: Mapped[str | None] = mapped_column(sa.String, nullable=True)
    action: Mapped[str] = mapped_column(sa.String, nullable=False)              # "view", "click", "export", "query"
    duration_ms: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)  # query/load time
    metadata_: Mapped[dict | None] = mapped_column("metadata", sa.JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=func.now())


# ── DashboardShare ────────────────────────────────────────────────────────────
class DashboardShare(Base):
    """Granular per-user/role sharing with permission levels."""

    __tablename__ = "dashboard_shares"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_dashboards.id", ondelete="CASCADE"), nullable=False
    )
    shared_with_user_id: Mapped[str | None] = mapped_column(sa.String, nullable=True)
    shared_with_role: Mapped[str | None] = mapped_column(sa.String, nullable=True)
    is_public: Mapped[bool] = mapped_column(sa.Boolean, default=False)
    permission: Mapped[str] = mapped_column(sa.String, default="view")          # "view", "edit", "admin"
    created_by: Mapped[str | None] = mapped_column(sa.String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)


# ── EmbedToken ────────────────────────────────────────────────────────────────
class EmbedToken(Base):
    """Secure embed tokens for public/partner embedding."""

    __tablename__ = "analytics_embed_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token: Mapped[str] = mapped_column(sa.String, unique=True, nullable=False, default=lambda: secrets.token_urlsafe(32))
    dashboard_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_dashboards.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(sa.String, nullable=False)                # friendly label
    created_by: Mapped[str | None] = mapped_column(sa.String, nullable=True)
    allowed_origins: Mapped[list | None] = mapped_column(sa.JSON, nullable=True)# list of allowed domains
    is_active: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    view_count: Mapped[int] = mapped_column(sa.Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=func.now())


# ── DataLineage ───────────────────────────────────────────────────────────────
class DataLineage(Base):
    """Tracks data lineage: which source tables/columns feed each widget/transform."""

    __tablename__ = "analytics_data_lineage"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Either a widget or a transform pipeline is the target
    widget_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_dashboard_widgets.id", ondelete="CASCADE"), nullable=True
    )
    transform_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_transform_pipelines.id", ondelete="CASCADE"), nullable=True
    )
    # Source description
    source_type: Mapped[str] = mapped_column(sa.String(50), nullable=False)  # "table" | "query" | "transform"
    source_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)  # table name or query label
    source_columns: Mapped[list | None] = mapped_column(sa.JSON, nullable=True)  # list of column names used
    # Graph edge: if source is another transform, link it
    source_transform_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("analytics_transform_pipelines.id", ondelete="SET NULL"), nullable=True
    )
    # Human-readable description of the transformation applied
    transformation_notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=func.now())
