"""Analytics models — dashboards, widgets, saved queries, reports, data alerts."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
        "DashboardWidget", back_populates="dashboard", cascade="all, delete-orphan"
    )


# ── DashboardWidget ──────────────────────────────────────────────────────────
class DashboardWidget(UUIDPrimaryKeyMixin, TimestampMixin, Base):
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
    )  # gt, lt, gte, lte, eq, neq
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
