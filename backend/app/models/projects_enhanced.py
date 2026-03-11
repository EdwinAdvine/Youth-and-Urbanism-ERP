"""Enhanced project models: checklists, relationships, custom fields, sprints,
recurring tasks, audit log, comments, automation rules, and guest access."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ── Sprint 1 models ─────────────────────────────────────────────────────────


class TaskChecklist(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A checklist item within a task."""

    __tablename__ = "project_task_checklists"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    task = relationship("Task", foreign_keys=[task_id])

    def __repr__(self) -> str:
        return f"<TaskChecklist id={self.id} title={self.title!r} completed={self.is_completed}>"


class TaskRelationship(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A custom relationship between two tasks (blocks, duplicates, relates_to)."""

    __tablename__ = "project_task_relationships"

    source_task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relationship_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="blocks | is_blocked_by | duplicates | is_duplicated_by | relates_to",
    )

    source_task = relationship("Task", foreign_keys=[source_task_id])
    target_task = relationship("Task", foreign_keys=[target_task_id])

    def __repr__(self) -> str:
        return (
            f"<TaskRelationship {self.source_task_id} "
            f"{self.relationship_type} {self.target_task_id}>"
        )


class ProjectCustomField(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A custom field definition for a project."""

    __tablename__ = "project_custom_fields"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    field_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="text | number | dropdown | date | formula",
    )
    options: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, comment="Dropdown choices, formula expression, etc."
    )
    default_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    project = relationship("Project", foreign_keys=[project_id])

    def __repr__(self) -> str:
        return f"<ProjectCustomField id={self.id} name={self.name!r} type={self.field_type}>"


class TaskCustomFieldValue(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A custom field value for a task. Uses typed columns for SQL filtering."""

    __tablename__ = "project_task_custom_field_values"
    __table_args__ = (
        UniqueConstraint("task_id", "field_id", name="uq_task_custom_field"),
    )

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_custom_fields.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_number: Mapped[float | None] = mapped_column(Float, nullable=True)
    value_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    task = relationship("Task", foreign_keys=[task_id])
    field = relationship("ProjectCustomField", foreign_keys=[field_id])

    def __repr__(self) -> str:
        return f"<TaskCustomFieldValue task={self.task_id} field={self.field_id}>"


class Sprint(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """An agile sprint within a project."""

    __tablename__ = "project_sprints"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="planning",
        comment="planning | active | completed",
    )

    project = relationship("Project", foreign_keys=[project_id])

    def __repr__(self) -> str:
        return f"<Sprint id={self.id} name={self.name!r} status={self.status}>"


# ── Sprint 2 models ─────────────────────────────────────────────────────────


class RecurringTaskConfig(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Configuration for recurring task generation."""

    __tablename__ = "project_recurring_configs"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    template_task: Mapped[dict] = mapped_column(
        JSONB, nullable=False,
        comment="Task template: {title, description, status, priority, assignee_id, tags}",
    )
    recurrence_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="daily | weekly | monthly | custom",
    )
    recurrence_interval: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    day_of_week: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="0=Mon..6=Sun"
    )
    day_of_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cron_expression: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="For custom recurrence"
    )
    next_run_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    project = relationship("Project", foreign_keys=[project_id])

    def __repr__(self) -> str:
        return (
            f"<RecurringTaskConfig id={self.id} project={self.project_id} "
            f"type={self.recurrence_type} active={self.is_active}>"
        )


class TaskAuditLog(Base, UUIDPrimaryKeyMixin):
    """Immutable audit trail for task changes. No updated_at — write-once."""

    __tablename__ = "project_task_audit_log"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="created | updated | status_changed | assigned | commented | checklist_toggled | deleted",
    )
    changes: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, comment='{field: {old: ..., new: ...}}'
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    task = relationship("Task", foreign_keys=[task_id])
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<TaskAuditLog task={self.task_id} action={self.action}>"


class TaskComment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A comment on a task with threading and @mentions."""

    __tablename__ = "project_task_comments"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_task_comments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    mentions: Mapped[list | None] = mapped_column(
        JSONB, nullable=True, comment="Array of mentioned user IDs"
    )
    is_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    task = relationship("Task", foreign_keys=[task_id])
    author = relationship("User", foreign_keys=[author_id])
    parent = relationship("TaskComment", remote_side="TaskComment.id", foreign_keys=[parent_id])
    replies = relationship(
        "TaskComment",
        foreign_keys=[parent_id],
        back_populates="parent",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<TaskComment id={self.id} task={self.task_id} author={self.author_id}>"


# ── Sprint 4 models ─────────────────────────────────────────────────────────


class AutomationRule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A no-code automation rule for a project."""

    __tablename__ = "project_automation_rules"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    trigger_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="status_change | due_date_reached | assignment_change | task_created | priority_change",
    )
    trigger_config: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True,
        comment='E.g. {from_status: "todo", to_status: "done"}',
    )
    action_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="assign_user | send_notification | move_to_status | create_subtask | add_tag",
    )
    action_config: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True,
        comment='E.g. {user_id: "...", status: "..."}',
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    execution_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    project = relationship("Project", foreign_keys=[project_id])

    def __repr__(self) -> str:
        return (
            f"<AutomationRule id={self.id} name={self.name!r} "
            f"trigger={self.trigger_type} action={self.action_type}>"
        )


# ── Sprint 5 models ─────────────────────────────────────────────────────────


class ProjectGuestAccess(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Guest access token for external collaborators on a project."""

    __tablename__ = "project_guest_access"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    permissions: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True,
        comment='{can_comment: true, can_view_tasks: true, can_edit_tasks: false}',
    )
    invited_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    project = relationship("Project", foreign_keys=[project_id])

    def __repr__(self) -> str:
        return f"<ProjectGuestAccess project={self.project_id} email={self.email!r}>"
