from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BaseModel


class LicenseType(str, enum.Enum):
    trial = "trial"
    standard = "standard"
    professional = "professional"
    enterprise = "enterprise"


class License(BaseModel):
    __tablename__ = "licenses"

    license_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    license_type: Mapped[LicenseType] = mapped_column(
        Enum(LicenseType, name="license_type_enum", create_constraint=True),
        nullable=False,
        default=LicenseType.trial,
    )
    max_users: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    current_users: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    features: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<License id={self.id} key={self.license_key} type={self.license_type}>"
