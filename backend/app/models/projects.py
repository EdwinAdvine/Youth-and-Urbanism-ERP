"""Project models: Project, Task, Milestone, and TimeLog."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Project(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A project that groups tasks and milestones.

    ``members`` is a JSON array of user-id strings for quick membership
    checks without a separate join table.
    """

    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",
        comment="active | completed | on_hold | cancelled",
    )

    start_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    color: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="CSS colour string e.g. #51459d",
    )

    # JSON array of user-id strings
    members: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    tasks = relationship(
        "Task",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    milestones = relationship(
        "Milestone",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Project id={self.id} name={self.name!r} status={self.status}>"


class Task(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A task within a project, shown on the Kanban board.

    ``tags`` is stored as a PostgreSQL ARRAY of TEXT values for efficient
    tag-based filtering without a separate join table.
    """

    __tablename__ = "project_tasks"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="todo",
        comment="todo | in_progress | in_review | done",
    )

    priority: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="medium",
        comment="low | medium | high | critical",
    )

    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # PostgreSQL native array
    tags: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(100)),
        nullable=True,
        default=list,
    )

    # Relationships
    project = relationship("Project", back_populates="tasks", foreign_keys=[project_id])
    assignee = relationship("User", foreign_keys=[assignee_id])
    time_logs = relationship(
        "TimeLog",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<Task id={self.id} title={self.title!r} "
            f"status={self.status} priority={self.priority}>"
        )


class Milestone(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A milestone within a project, representing a key deadline or deliverable."""

    __tablename__ = "project_milestones"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)

    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    project = relationship("Project", back_populates="milestones", foreign_keys=[project_id])

    def __repr__(self) -> str:
        return (
            f"<Milestone id={self.id} title={self.title!r} "
            f"completed={self.is_completed}>"
        )


class TimeLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A time entry logged against a task by a user."""

    __tablename__ = "project_time_logs"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    hours: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    task = relationship("Task", back_populates="time_logs", foreign_keys=[task_id])
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return (
            f"<TimeLog id={self.id} task={self.task_id} "
            f"user={self.user_id} hours={self.hours}>"
        )


class TaskDependency(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A dependency between two tasks (e.g. finish-to-start)."""

    __tablename__ = "project_task_dependencies"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    depends_on_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    dependency_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="finish_to_start",
        comment="finish_to_start | start_to_start | finish_to_finish | start_to_finish",
    )

    # Relationships
    task = relationship("Task", foreign_keys=[task_id])
    depends_on = relationship("Task", foreign_keys=[depends_on_id])

    def __repr__(self) -> str:
        return (
            f"<TaskDependency id={self.id} task={self.task_id} "
            f"depends_on={self.depends_on_id} type={self.dependency_type}>"
        )


class ProjectMilestone(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """An enhanced milestone with status tracking and completion timestamp."""

    __tablename__ = "project_milestones_v2"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(500), nullable=False)

    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="open",
        comment="open | completed",
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    project = relationship("Project", foreign_keys=[project_id])

    def __repr__(self) -> str:
        return (
            f"<ProjectMilestone id={self.id} name={self.name!r} "
            f"status={self.status}>"
        )


class TaskAttachment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A file attachment linked to a project task."""

    __tablename__ = "project_task_attachments"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )

    file_name: Mapped[str] = mapped_column(String(500), nullable=False)

    # Relationships
    task = relationship("Task", foreign_keys=[task_id])

    def __repr__(self) -> str:
        return (
            f"<TaskAttachment id={self.id} task={self.task_id} "
            f"file={self.file_name!r}>"
        )


class ProjectTemplate(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A reusable project template with predefined tasks and settings."""

    __tablename__ = "project_templates"

    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # JSON array of task definitions [{title, description, status, priority, order, tags}, ...]
    tasks: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)

    # JSON object for template-level settings (color, default members, etc.)
    settings: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])

    def __repr__(self) -> str:
        return f"<ProjectTemplate id={self.id} name={self.name!r}>"
