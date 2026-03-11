from __future__ import annotations

import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModel, TimestampMixin, UUIDPrimaryKeyMixin


class SSOProviderType(str, enum.Enum):
    google = "google"
    microsoft = "microsoft"
    github = "github"
    custom_oidc = "custom_oidc"


class SSOProvider(BaseModel):
    __tablename__ = "sso_providers"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    provider_type: Mapped[SSOProviderType] = mapped_column(
        Enum(SSOProviderType, name="sso_provider_type_enum", create_constraint=True),
        nullable=False,
    )
    client_id: Mapped[str] = mapped_column(String(500), nullable=False)
    client_secret: Mapped[str] = mapped_column(Text, nullable=False, comment="Encrypted with Fernet")
    authorization_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    token_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    userinfo_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    redirect_uri: Mapped[str] = mapped_column(String(1000), nullable=False)
    scopes: Mapped[str] = mapped_column(String(500), nullable=False, default="openid email profile")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # relationships
    user_mappings: Mapped[list[SSOUserMapping]] = relationship(
        "SSOUserMapping", back_populates="provider", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<SSOProvider id={self.id} name={self.name} type={self.provider_type}>"


class SSOUserMapping(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "sso_user_mappings"
    __table_args__ = (UniqueConstraint("provider_id", "external_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sso_providers.id", ondelete="CASCADE"), nullable=False
    )
    external_id: Mapped[str] = mapped_column(String(500), nullable=False)
    external_email: Mapped[str] = mapped_column(String(255), nullable=False)

    # relationships
    provider: Mapped[SSOProvider] = relationship("SSOProvider", back_populates="user_mappings")
