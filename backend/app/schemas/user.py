from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ── User ─────────────────────────────────────────────────────────────────────
class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    is_superadmin: bool = False


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    is_active: bool | None = None
    avatar_url: str | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    is_superadmin: bool
    avatar_url: str | None
    last_login: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserMeResponse(UserResponse):
    """Extended response for /auth/me with computed role, app-admin scopes, app access and permissions."""

    role: str  # "superadmin" | "admin" | "user"
    app_admin_scopes: list[str] = []  # e.g. ["finance", "hr"]
    app_access: list[str] = []        # apps the user has explicit access to
    permissions: list[str] = []       # all resolved permission names via roles


# ── Role ─────────────────────────────────────────────────────────────────────
class RoleCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    app_scope: str | None = None
    is_system: bool = False


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = None
    app_scope: str | None = None


class RoleResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    app_scope: str | None
    is_system: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Permission ────────────────────────────────────────────────────────────────
class PermissionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: str | None = None
    app_scope: str | None = None


class PermissionResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    app_scope: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── UserRole assignment ───────────────────────────────────────────────────────
class AssignRoleRequest(BaseModel):
    user_id: uuid.UUID
    role_id: uuid.UUID


class RevokeRoleRequest(BaseModel):
    user_id: uuid.UUID
    role_id: uuid.UUID


# ── AppAdmin ──────────────────────────────────────────────────────────────────
class AppAdminCreate(BaseModel):
    user_id: uuid.UUID
    app_name: str = Field(..., min_length=2, max_length=100)


class AppAdminResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    app_name: str
    granted_by: uuid.UUID | None
    granted_at: datetime

    model_config = {"from_attributes": True}


# ── Team ──────────────────────────────────────────────────────────────────────
class TeamCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: str | None = None
    app_scope: str | None = None


class TeamUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    app_scope: str | None = None


class TeamResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    app_scope: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AddTeamMemberRequest(BaseModel):
    user_id: uuid.UUID
    role_in_team: str | None = None


# ── App Access ────────────────────────────────────────────────────────────────
class AppAccessEntry(BaseModel):
    app_name: str
    granted: bool

    model_config = {"from_attributes": True}


class AppAccessBulkUpdate(BaseModel):
    app_grants: dict[str, bool]  # {"finance": True, "hr": False}


# ── Audit Log ─────────────────────────────────────────────────────────────────
class AuditLogResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    user_email: str | None
    action: str
    resource_type: str | None
    resource_id: str | None
    metadata_: dict | None = None
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


# ── Role + Permissions ────────────────────────────────────────────────────────
class RoleWithPermissionsResponse(RoleResponse):
    permissions: list[PermissionResponse] = []


class BulkPermissionAssign(BaseModel):
    permission_ids: list[uuid.UUID]
    replace: bool = False
