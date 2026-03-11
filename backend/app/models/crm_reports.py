"""CRM Phase 2 — Reports, dashboards, and gamification models."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SavedReport(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """User-saved report configuration."""

    __tablename__ = "crm_saved_reports"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    report_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # pipeline, revenue, activity, conversion, forecast
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )


class DashboardWidget(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Configurable widget within a CRM dashboard."""

    __tablename__ = "crm_dashboard_widgets"

    dashboard_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    widget_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # stat_card, chart, table, funnel, leaderboard
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    position_x: Mapped[int] = mapped_column(Integer, default=0)
    position_y: Mapped[int] = mapped_column(Integer, default=0)
    width: Mapped[int] = mapped_column(Integer, default=1)
    height: Mapped[int] = mapped_column(Integer, default=1)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )


class GamificationScore(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Sales gamification score per user per time period."""

    __tablename__ = "crm_gamification_scores"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    period: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # daily, weekly, monthly
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0)
    deals_closed: Mapped[int] = mapped_column(Integer, default=0)
    deals_value: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("0")
    )
    activities_completed: Mapped[int] = mapped_column(Integer, default=0)
    leads_converted: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
