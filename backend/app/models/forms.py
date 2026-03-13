"""Form models: Form, FormField, FormResponse, FormVersion, FormFieldOption,
FormWebhook, FormAuditLog, and collaboration models."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ── Field type registry ──────────────────────────────────────────────────────

FIELD_TYPES = {
    # Basic
    "text", "textarea", "number", "email", "phone", "url",
    "date", "time", "datetime",
    # Choice
    "select", "checkbox", "radio", "dropdown",
    "cascading_select", "ranking",
    # Scale & Rating
    "rating", "likert", "nps", "slider",
    # Matrix
    "matrix",
    # Media & Files
    "file", "photo", "video", "audio",
    "signature",
    # Location & Scanning
    "gps", "barcode",
    # Layout
    "section_header", "description", "page_break",
    # Computed
    "calculated",
    # ERP-native
    "employee_picker", "product_picker", "customer_picker",
    "gl_account_picker", "warehouse_picker",
}


class Form(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A user-created form for collecting responses.

    ``settings`` is a JSON object holding configuration such as
    ``allow_anonymous``, ``max_responses``, ``close_date``,
    ``logic_rules``, ``theme``, ``quiz_settings``, ``schedule``, etc.
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

    # JSON object: allow_anonymous, max_responses, close_date,
    # logic_rules, theme, quiz_settings, schedule, erp_actions, etc.
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
    versions = relationship(
        "FormVersion",
        back_populates="form",
        cascade="all, delete-orphan",
        order_by="FormVersion.version_number.desc()",
    )
    webhooks = relationship(
        "FormWebhook",
        back_populates="form",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Form id={self.id} title={self.title!r} owner={self.owner_id}>"


class FormField(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A single field/question within a Form.

    Supports 30+ field types including ERP-native pickers.
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
        comment="See FIELD_TYPES in models/forms.py for full list (30+ types)",
    )

    # JSON array of choices for select/radio/checkbox/ranking/cascading fields
    options: Mapped[list | None] = mapped_column(JSON, nullable=True)

    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # JSON object for custom validation constraints
    validation_rules: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # New Phase 1 columns
    page_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    placeholder: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # JSON for type-specific config: GPS accuracy, media quality,
    # calculation formula, Likert labels, matrix rows/cols, slider min/max, etc.
    field_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)

    # Relationships
    form = relationship("Form", back_populates="fields", foreign_keys=[form_id])
    field_options = relationship(
        "FormFieldOption",
        back_populates="field",
        cascade="all, delete-orphan",
        order_by="FormFieldOption.order",
    )

    def __repr__(self) -> str:
        return (
            f"<FormField id={self.id} label={self.label!r} "
            f"type={self.field_type} form={self.form_id}>"
        )


class FormFieldOption(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Individual option for choice-based fields.

    Supports cascading selects (parent_option_id) and quiz scoring (score).
    """

    __tablename__ = "form_field_options"

    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("form_fields.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(500), nullable=False)
    value: Mapped[str] = mapped_column(String(500), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # For cascading selects: which parent option triggers this option
    parent_option_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("form_field_options.id", ondelete="SET NULL"),
        nullable=True,
    )

    # For quiz mode: score awarded for selecting this option
    score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # For correct answer marking in quiz mode
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    field = relationship("FormField", back_populates="field_options", foreign_keys=[field_id])
    children = relationship("FormFieldOption", foreign_keys=[parent_option_id])

    def __repr__(self) -> str:
        return f"<FormFieldOption id={self.id} label={self.label!r} field={self.field_id}>"


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

    # Sandbox/preview responses excluded from analytics
    is_sandbox: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    form = relationship("Form", back_populates="responses", foreign_keys=[form_id])
    respondent = relationship("User", foreign_keys=[respondent_id])

    def __repr__(self) -> str:
        return (
            f"<FormResponse id={self.id} form={self.form_id} "
            f"respondent={self.respondent_id}>"
        )


class FormVersion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Snapshot of a form's schema at a point in time (created on each publish)."""

    __tablename__ = "form_versions"

    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("forms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Full snapshot: title, description, settings, fields with options
    schema_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)

    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    form = relationship("Form", back_populates="versions", foreign_keys=[form_id])
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<FormVersion form={self.form_id} v{self.version_number}>"


class FormWebhook(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Outbound webhook fired on form events (submitted, approved, etc.)."""

    __tablename__ = "form_webhooks"

    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("forms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url: Mapped[str] = mapped_column(String(2000), nullable=False)
    secret: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # JSON array of event names: ["submitted", "approved", "rejected"]
    events: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    form = relationship("Form", back_populates="webhooks", foreign_keys=[form_id])

    def __repr__(self) -> str:
        return f"<FormWebhook id={self.id} form={self.form_id} url={self.url!r}>"


class FormAuditLog(Base, UUIDPrimaryKeyMixin):
    """Audit trail for form operations."""

    __tablename__ = "form_audit_logs"

    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("forms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="created | updated | published | unpublished | deleted | exported | field_added | field_removed",
    )
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    form = relationship("Form", foreign_keys=[form_id])
    user = relationship("User", foreign_keys=[user_id])


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


# ── Phase 2 & Phase 3 Models ─────────────────────────────────────────────────


class FormResponseDraft(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Offline-created draft not yet submitted."""

    __tablename__ = "form_response_drafts"

    form_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    draft_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    offline_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    form = relationship("Form", foreign_keys=[form_id])
    user = relationship("User", foreign_keys=[user_id])


class FormQuizResult(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Quiz score for a form response."""

    __tablename__ = "form_quiz_results"

    form_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    response_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("form_responses.id", ondelete="CASCADE"), nullable=False, unique=True)
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    max_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    percentage: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    pass_fail: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "pass" | "fail"
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    graded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ai_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    form = relationship("Form", foreign_keys=[form_id])
    response = relationship("FormResponse", foreign_keys=[response_id])
    grader = relationship("User", foreign_keys=[graded_by])


class FormSchedule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Recurring form distribution schedule."""

    __tablename__ = "form_schedules"

    form_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    recurrence_rule: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="RFC 5545 RRULE string")
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recipients: Mapped[list | None] = mapped_column(JSON, nullable=True, comment="List of email addresses or user IDs")
    distribution_channel: Mapped[str] = mapped_column(String(20), nullable=False, default="email", comment="email | in_app | both")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    form = relationship("Form", foreign_keys=[form_id])


class FormApprovalWorkflow(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Approval chain for form responses (Phase 3)."""

    __tablename__ = "form_approval_workflows"

    form_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, unique=True)
    steps: Mapped[list] = mapped_column(JSON, nullable=False, default=list, comment="List of {approver_id, role, step_index, label}")
    current_step: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    form = relationship("Form", foreign_keys=[form_id])


class FormResponseApproval(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One approval record per step per response."""

    __tablename__ = "form_response_approvals"

    response_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("form_responses.id", ondelete="CASCADE"), nullable=False, index=True)
    step_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    approver_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", comment="pending | approved | rejected")
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    response = relationship("FormResponse", foreign_keys=[response_id])
    approver = relationship("User", foreign_keys=[approver_id])


class FormTranslation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Multi-language support for forms."""

    __tablename__ = "form_translations"

    form_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    locale: Mapped[str] = mapped_column(String(10), nullable=False, comment="BCP-47 locale code e.g. en, fr, sw, ar")
    translations: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict, comment="{field_id: {label: str, options: [str], description: str}}")
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    form = relationship("Form", foreign_keys=[form_id])


class FormConsent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """GDPR consent configuration for a form."""

    __tablename__ = "form_consents"

    form_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, unique=True)
    consent_text: Mapped[str] = mapped_column(Text, nullable=False, default="I agree to the privacy policy and data processing terms.")
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    data_retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    privacy_policy_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    form = relationship("Form", foreign_keys=[form_id])


class FormConsentRecord(Base, UUIDPrimaryKeyMixin):
    """Per-respondent consent record."""

    __tablename__ = "form_consent_records"

    form_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    response_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("form_responses.id", ondelete="SET NULL"), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class FormAutomation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Visual automation rule (trigger → actions)."""

    __tablename__ = "form_automations"

    form_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    trigger: Mapped[str] = mapped_column(String(50), nullable=False, comment="submitted | approved | rejected | scheduled")
    trigger_conditions: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    actions: Mapped[list] = mapped_column(JSON, nullable=False, default=list, comment="[{type: create_lead|send_email|create_invoice|assign_task|update_inventory, config: {}}]")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    run_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    form = relationship("Form", foreign_keys=[form_id])
