"""Form models: Form, FormField, and FormResponse."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Form(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A user-created form for collecting responses.

    ``settings`` is a JSON object holding configuration such as
    ``allow_anonymous``, ``max_responses``, and ``close_date``.
    """

    __tablename__ = "forms"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_template: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # JSON object: allow_anonymous, max_responses, close_date, etc.
    settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    fields = relationship(
        "FormField",
        back_populates="form",
        cascade="all, delete-orphan",
    )
    responses = relationship(
        "FormResponse",
        back_populates="form",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Form id={self.id} title={self.title!r} owner={self.owner_id}>"


class FormField(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A single field/question within a Form.

    ``field_type`` is one of: text, textarea, number, email, select,
    checkbox, radio, date, file.  ``options`` holds the choices for
    select/radio/checkbox fields.  ``validation_rules`` holds custom
    validation constraints as a JSON object.
    """

    __tablename__ = "form_fields"

    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("forms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    label: Mapped[str] = mapped_column(String(500), nullable=False)

    field_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="text",
        comment="text | textarea | number | email | select | checkbox | radio | date | file",
    )

    # JSON array of choices for select/radio/checkbox fields
    options: Mapped[list | None] = mapped_column(JSON, nullable=True)

    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # JSON object for custom validation constraints
    validation_rules: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    form = relationship("Form", back_populates="fields", foreign_keys=[form_id])

    def __repr__(self) -> str:
        return (
            f"<FormField id={self.id} label={self.label!r} "
            f"type={self.field_type} form={self.form_id}>"
        )


class FormResponse(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A single response/submission to a Form.

    ``respondent_id`` is nullable to support anonymous submissions.
    ``answers`` is a JSON object mapping field IDs to their values.
    """

    __tablename__ = "form_responses"

    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("forms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    respondent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # JSON object: { "<field_id>": <value>, ... }
    answers: Mapped[dict] = mapped_column(JSON, nullable=False)

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    form = relationship("Form", back_populates="responses", foreign_keys=[form_id])
    respondent = relationship("User", foreign_keys=[respondent_id])

    def __repr__(self) -> str:
        return (
            f"<FormResponse id={self.id} form={self.form_id} "
            f"respondent={self.respondent_id}>"
        )


class FormTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Reusable form template with pre-defined schema."""

    __tablename__ = "form_templates"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    schema: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)


class FormCollaborator(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Collaborator on a form with role-based access."""

    __tablename__ = "form_collaborators"

    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("forms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="viewer",
        comment="editor | viewer",
    )

    form = relationship("Form", foreign_keys=[form_id])
    user = relationship("User", foreign_keys=[user_id])
