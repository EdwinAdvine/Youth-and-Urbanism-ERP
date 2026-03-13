from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel, TimestampMixin, UUIDPrimaryKeyMixin


# ── User ─────────────────────────────────────────────────────────────────────
class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_bot: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        comment="System bot users (AI assistant, webhook bots)",
    )
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Security fields ──────────────────────────────────────────────────────
    failed_login_count: Mapped[int] = mapped_column(
        default=0, nullable=False, server_default="0",
    )
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    password_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false",
    )
    mfa_required: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false",
        comment="If true, user must set up MFA before accessing the platform",
    )

    # relationships
    user_roles: Mapped[list[UserRole]] = relationship(
        "UserRole",
        foreign_keys="[UserRole.user_id]",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    app_admin_entries: Mapped[list[AppAdmin]] = relationship(
        "AppAdmin", foreign_keys="AppAdmin.user_id", back_populates="user", cascade="all, delete-orphan"
    )
    app_access_entries: Mapped[list[AppAccess]] = relationship(
        "AppAccess", foreign_keys="AppAccess.user_id", back_populates="user", cascade="all, delete-orphan"
    )
    team_memberships: Mapped[list[TeamMember]] = relationship(
        "TeamMember", back_populates="user", cascade="all, delete-orphan"
    )
    calendar_webhooks = relationship(
        "CalendarWebhook", back_populates="user", cascade="all, delete-orphan"
    )
    calendar_api_keys = relationship(
        "CalendarApiKey", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"


# ── Role ─────────────────────────────────────────────────────────────────────
class Role(BaseModel):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    app_scope: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
        comment="If set, this role is scoped to a specific application module",
    )
    is_system: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        comment="System roles cannot be deleted",
    )

    role_permissions: Mapped[list[RolePermission]] = relationship(
        "RolePermission", back_populates="role", cascade="all, delete-orphan"
    )
    user_roles: Mapped[list[UserRole]] = relationship(
        "UserRole", back_populates="role", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Role id={self.id} name={self.name}>"


# ── Permission ────────────────────────────────────────────────────────────────
class Permission(BaseModel):
    __tablename__ = "permissions"

    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    app_scope: Mapped[str | None] = mapped_column(String(100), nullable=True)

    role_permissions: Mapped[list[RolePermission]] = relationship(
        "RolePermission", back_populates="permission", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Permission id={self.id} name={self.name}>"


# ── RolePermission (association) ──────────────────────────────────────────────
class RolePermission(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id"),)

    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False
    )

    role: Mapped[Role] = relationship("Role", back_populates="role_permissions")
    permission: Mapped[Permission] = relationship("Permission", back_populates="role_permissions")


# ── UserRole (association) ────────────────────────────────────────────────────
class UserRole(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
    )
    granted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    user: Mapped[User] = relationship("User", foreign_keys=[user_id], back_populates="user_roles")
    role: Mapped[Role] = relationship("Role", back_populates="user_roles")


# ── AppAdmin ──────────────────────────────────────────────────────────────────
class AppAdmin(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "app_admins"
    __table_args__ = (UniqueConstraint("user_id", "app_name"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    app_name: Mapped[str] = mapped_column(String(100), nullable=False)
    granted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped[User] = relationship("User", foreign_keys=[user_id], back_populates="app_admin_entries")
    grantor: Mapped[User | None] = relationship("User", foreign_keys=[granted_by])


# ── Team ──────────────────────────────────────────────────────────────────────
class Team(BaseModel):
    __tablename__ = "teams"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    app_scope: Mapped[str | None] = mapped_column(String(100), nullable=True)

    members: Mapped[list[TeamMember]] = relationship(
        "TeamMember", back_populates="team", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Team id={self.id} name={self.name}>"


# ── TeamMember (association) ──────────────────────────────────────────────────
class TeamMember(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id"),)

    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role_in_team: Mapped[str | None] = mapped_column(String(100), nullable=True)

    team: Mapped[Team] = relationship("Team", back_populates="members")
    user: Mapped[User] = relationship("User", back_populates="team_memberships")


# ── AppAccess ─────────────────────────────────────────────────────────────────
class AppAccess(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Per-user toggle controlling whether a user can access an application module."""

    __tablename__ = "app_access"
    __table_args__ = (UniqueConstraint("user_id", "app_name"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    app_name: Mapped[str] = mapped_column(String(100), nullable=False)
    granted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    granted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped[User] = relationship("User", foreign_keys=[user_id], back_populates="app_access_entries")
    grantor: Mapped[User | None] = relationship("User", foreign_keys=[granted_by])

    def __repr__(self) -> str:
        return f"<AppAccess user_id={self.user_id} app={self.app_name} granted={self.granted}>"


# ── AppConfig ─────────────────────────────────────────────────────────────────
class AppConfig(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Persisted per-app configuration (replaces in-memory dict in app_admin.py)."""

    __tablename__ = "app_configs"
    __table_args__ = (UniqueConstraint("app_name", "config_key"),)

    app_name: Mapped[str] = mapped_column(String(100), nullable=False)
    config_key: Mapped[str] = mapped_column(String(150), nullable=False)
    # Stored as JSON-serialised text for broad compatibility
    config_value: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<AppConfig app={self.app_name} key={self.config_key}>"


# ── AuditLog ──────────────────────────────────────────────────────────────────
class AuditLog(Base, UUIDPrimaryKeyMixin):
    """Immutable audit trail for admin actions (user CRUD, role/permission changes, etc.)."""

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_user_id", "user_id"),
        Index("ix_audit_logs_action", "action"),
        Index("ix_audit_logs_created_at", "created_at"),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Snapshot of email in case user is later deleted
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Dot-namespaced action string e.g. "user.created", "role.assigned"
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )

    def __repr__(self) -> str:
        return f"<AuditLog action={self.action} user_id={self.user_id}>"
