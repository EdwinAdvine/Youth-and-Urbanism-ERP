from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import (
    AppAccess,
    AppAdmin,
    AppConfig,
    AuditLog,
    Permission,
    Role,
    RolePermission,
    Team,
    TeamMember,
    User,
    UserRole,
)
from app.schemas.user import (
    AppAdminCreate,
    AssignRoleRequest,
    PermissionCreate,
    RoleCreate,
    RoleUpdate,
    TeamCreate,
    TeamUpdate,
    UserCreate,
    UserUpdate,
)


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Users ─────────────────────────────────────────────────────────────────
    async def list_users(self, skip: int = 0, limit: int = 50) -> list[User]:
        result = await self.db.execute(
            select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().all())

    async def get_user(self, user_id: uuid.UUID) -> User:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    async def create_user(self, payload: UserCreate) -> User:
        existing = await self.db.execute(select(User).where(User.email == payload.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        user = User(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=hash_password(payload.password),
            is_superadmin=payload.is_superadmin,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update_user(self, user_id: uuid.UUID, payload: UserUpdate) -> User:
        user = await self.get_user(user_id)
        data = payload.model_dump(exclude_unset=True)
        if "password" in data:
            data["hashed_password"] = hash_password(data.pop("password"))
        for key, value in data.items():
            setattr(user, key, value)
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def delete_user(self, user_id: uuid.UUID) -> None:
        user = await self.get_user(user_id)
        await self.db.delete(user)
        await self.db.flush()

    # ── Roles ─────────────────────────────────────────────────────────────────
    async def list_roles(self) -> list[Role]:
        result = await self.db.execute(select(Role).order_by(Role.name))
        return list(result.scalars().all())

    async def get_role(self, role_id: uuid.UUID) -> Role:
        result = await self.db.execute(select(Role).where(Role.id == role_id))
        role = result.scalar_one_or_none()
        if role is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
        return role

    async def create_role(self, payload: RoleCreate) -> Role:
        existing = await self.db.execute(select(Role).where(Role.name == payload.name))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role name already exists")

        role = Role(**payload.model_dump())
        self.db.add(role)
        await self.db.flush()
        await self.db.refresh(role)
        return role

    async def update_role(self, role_id: uuid.UUID, payload: RoleUpdate) -> Role:
        role = await self.get_role(role_id)
        if role.is_system:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify system roles")
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(role, key, value)
        self.db.add(role)
        await self.db.flush()
        await self.db.refresh(role)
        return role

    async def delete_role(self, role_id: uuid.UUID) -> None:
        role = await self.get_role(role_id)
        if role.is_system:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete system roles")
        await self.db.delete(role)
        await self.db.flush()

    # ── Permissions ───────────────────────────────────────────────────────────
    async def list_permissions(self) -> list[Permission]:
        result = await self.db.execute(select(Permission).order_by(Permission.name))
        return list(result.scalars().all())

    async def create_permission(self, payload: PermissionCreate) -> Permission:
        existing = await self.db.execute(select(Permission).where(Permission.name == payload.name))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Permission already exists")

        perm = Permission(**payload.model_dump())
        self.db.add(perm)
        await self.db.flush()
        await self.db.refresh(perm)
        return perm

    async def assign_permission_to_role(self, role_id: uuid.UUID, permission_id: uuid.UUID) -> None:
        existing = await self.db.execute(
            select(RolePermission).where(
                RolePermission.role_id == role_id,
                RolePermission.permission_id == permission_id,
            )
        )
        if existing.scalar_one_or_none():
            return  # idempotent
        rp = RolePermission(role_id=role_id, permission_id=permission_id)
        self.db.add(rp)
        await self.db.flush()

    async def remove_permission_from_role(self, role_id: uuid.UUID, permission_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(RolePermission).where(
                RolePermission.role_id == role_id,
                RolePermission.permission_id == permission_id,
            )
        )
        rp = result.scalar_one_or_none()
        if rp:
            await self.db.delete(rp)
            await self.db.flush()

    # ── User ↔ Role assignment ────────────────────────────────────────────────
    async def assign_role_to_user(
        self, payload: AssignRoleRequest, granted_by: uuid.UUID
    ) -> None:
        existing = await self.db.execute(
            select(UserRole).where(
                UserRole.user_id == payload.user_id,
                UserRole.role_id == payload.role_id,
            )
        )
        if existing.scalar_one_or_none():
            return

        ur = UserRole(
            user_id=payload.user_id,
            role_id=payload.role_id,
            granted_by=granted_by,
            granted_at=datetime.now(UTC),
        )
        self.db.add(ur)
        await self.db.flush()

    async def revoke_role_from_user(self, user_id: uuid.UUID, role_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(UserRole).where(
                UserRole.user_id == user_id,
                UserRole.role_id == role_id,
            )
        )
        ur = result.scalar_one_or_none()
        if ur:
            await self.db.delete(ur)
            await self.db.flush()

    # ── App Admins ────────────────────────────────────────────────────────────
    async def list_app_admins(self) -> list[AppAdmin]:
        result = await self.db.execute(
            select(AppAdmin).order_by(AppAdmin.granted_at.desc())
        )
        return list(result.scalars().all())

    async def grant_app_admin(self, payload: AppAdminCreate, granted_by: uuid.UUID) -> AppAdmin:
        existing = await self.db.execute(
            select(AppAdmin).where(
                AppAdmin.user_id == payload.user_id,
                AppAdmin.app_name == payload.app_name,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already an app admin")

        aa = AppAdmin(
            user_id=payload.user_id,
            app_name=payload.app_name,
            granted_by=granted_by,
            granted_at=datetime.now(UTC),
        )
        self.db.add(aa)
        await self.db.flush()
        await self.db.refresh(aa)
        return aa

    async def revoke_app_admin(self, app_admin_id: uuid.UUID) -> None:
        result = await self.db.execute(select(AppAdmin).where(AppAdmin.id == app_admin_id))
        aa = result.scalar_one_or_none()
        if aa is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App admin record not found")
        await self.db.delete(aa)
        await self.db.flush()

    # ── Teams ─────────────────────────────────────────────────────────────────
    async def list_teams(self) -> list[Team]:
        result = await self.db.execute(select(Team).order_by(Team.name))
        return list(result.scalars().all())

    async def create_team(self, payload: TeamCreate) -> Team:
        team = Team(**payload.model_dump())
        self.db.add(team)
        await self.db.flush()
        await self.db.refresh(team)
        return team

    async def update_team(self, team_id: uuid.UUID, payload: TeamUpdate) -> Team:
        result = await self.db.execute(select(Team).where(Team.id == team_id))
        team = result.scalar_one_or_none()
        if team is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(team, key, value)
        self.db.add(team)
        await self.db.flush()
        await self.db.refresh(team)
        return team

    async def delete_team(self, team_id: uuid.UUID) -> None:
        result = await self.db.execute(select(Team).where(Team.id == team_id))
        team = result.scalar_one_or_none()
        if team is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        await self.db.delete(team)
        await self.db.flush()

    async def add_team_member(
        self, team_id: uuid.UUID, user_id: uuid.UUID, role_in_team: str | None = None
    ) -> TeamMember:
        existing = await self.db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already in team")

        tm = TeamMember(team_id=team_id, user_id=user_id, role_in_team=role_in_team)
        self.db.add(tm)
        await self.db.flush()
        await self.db.refresh(tm)
        return tm

    async def remove_team_member(self, team_id: uuid.UUID, user_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
        )
        tm = result.scalar_one_or_none()
        if tm is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")
        await self.db.delete(tm)
        await self.db.flush()

    # ── App Access ────────────────────────────────────────────────────────────
    async def list_user_app_access(self, user_id: uuid.UUID) -> list[AppAccess]:
        result = await self.db.execute(
            select(AppAccess).where(AppAccess.user_id == user_id).order_by(AppAccess.app_name)
        )
        return list(result.scalars().all())

    async def set_app_access(
        self,
        user_id: uuid.UUID,
        app_name: str,
        granted: bool,
        granted_by: uuid.UUID | None = None,
    ) -> AppAccess:
        result = await self.db.execute(
            select(AppAccess).where(AppAccess.user_id == user_id, AppAccess.app_name == app_name)
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            entry = AppAccess(user_id=user_id, app_name=app_name, granted=granted, granted_by=granted_by)
            self.db.add(entry)
        else:
            entry.granted = granted
            if granted_by is not None:
                entry.granted_by = granted_by
        await self.db.flush()
        await self.db.refresh(entry)
        return entry

    async def bulk_set_app_access(
        self,
        user_id: uuid.UUID,
        app_grants: dict[str, bool],
        granted_by: uuid.UUID | None = None,
    ) -> int:
        count = 0
        for app_name, granted in app_grants.items():
            await self.set_app_access(user_id, app_name, granted, granted_by)
            count += 1
        return count

    async def get_accessible_apps(self, user_id: uuid.UUID) -> list[str]:
        """Return app names where this user has an explicit granted=True row.

        If the user has NO rows at all, returns [] (caller should treat as
        'no restrictions' for backward compatibility, handled at the API layer).
        """
        result = await self.db.execute(
            select(AppAccess.app_name)
            .where(AppAccess.user_id == user_id, AppAccess.granted.is_(True))
            .order_by(AppAccess.app_name)
        )
        return [row[0] for row in result.all()]

    # ── App Config (persisted) ────────────────────────────────────────────────
    async def get_app_config(self, app_name: str) -> dict[str, Any]:
        """Read all config keys for an app from DB. Returns dict of key→value."""
        result = await self.db.execute(
            select(AppConfig).where(AppConfig.app_name == app_name)
        )
        rows = list(result.scalars().all())
        config: dict[str, Any] = {}
        for row in rows:
            try:
                config[row.config_key] = json.loads(row.config_value)
            except (json.JSONDecodeError, TypeError):
                config[row.config_key] = row.config_value
        return config

    async def set_app_config(
        self, app_name: str, config: dict[str, Any], updated_by: uuid.UUID | None = None
    ) -> dict[str, Any]:
        """Upsert each key in config dict as a separate AppConfig row."""
        for key, value in config.items():
            result = await self.db.execute(
                select(AppConfig).where(AppConfig.app_name == app_name, AppConfig.config_key == key)
            )
            row = result.scalar_one_or_none()
            serialized = json.dumps(value)
            if row is None:
                row = AppConfig(
                    app_name=app_name,
                    config_key=key,
                    config_value=serialized,
                    updated_by=updated_by,
                )
                self.db.add(row)
            else:
                row.config_value = serialized
                if updated_by is not None:
                    row.updated_by = updated_by
        await self.db.flush()
        return await self.get_app_config(app_name)

    # ── Audit Logs ────────────────────────────────────────────────────────────
    async def log_action(
        self,
        action: str,
        *,
        user_id: uuid.UUID | None = None,
        user_email: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        metadata: dict | None = None,
        ip_address: str | None = None,
    ) -> None:
        entry = AuditLog(
            user_id=user_id,
            user_email=user_email,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_=metadata,
            ip_address=ip_address,
        )
        self.db.add(entry)
        await self.db.flush()

    async def list_audit_logs(
        self,
        skip: int = 0,
        limit: int = 50,
        user_id: uuid.UUID | None = None,
        action: str | None = None,
        resource_type: str | None = None,
    ) -> list[AuditLog]:
        q = select(AuditLog).order_by(AuditLog.created_at.desc())
        if user_id is not None:
            q = q.where(AuditLog.user_id == user_id)
        if action is not None:
            q = q.where(AuditLog.action == action)
        if resource_type is not None:
            q = q.where(AuditLog.resource_type == resource_type)
        result = await self.db.execute(q.offset(skip).limit(limit))
        return list(result.scalars().all())

    # ── Role permissions (bulk) ───────────────────────────────────────────────
    async def get_role_permissions(self, role_id: uuid.UUID) -> list[Permission]:
        result = await self.db.execute(
            select(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role_id)
            .order_by(Permission.app_scope, Permission.name)
        )
        return list(result.scalars().all())

    async def bulk_assign_permissions(
        self,
        role_id: uuid.UUID,
        permission_ids: list[uuid.UUID],
        replace: bool = False,
    ) -> dict[str, int]:
        """Assign a list of permissions to a role. If replace=True, removes unlisted ones."""
        role = await self.get_role(role_id)
        if role.is_system:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify permissions of system roles",
            )

        assigned = 0
        removed = 0
        new_set = set(permission_ids)

        if replace:
            # Find existing role-permission rows
            existing_result = await self.db.execute(
                select(RolePermission).where(RolePermission.role_id == role_id)
            )
            existing_rps = list(existing_result.scalars().all())
            existing_set = {rp.permission_id for rp in existing_rps}

            # Remove permissions not in new_set
            for rp in existing_rps:
                if rp.permission_id not in new_set:
                    await self.db.delete(rp)
                    removed += 1

            # Add permissions not already present
            for pid in new_set:
                if pid not in existing_set:
                    self.db.add(RolePermission(role_id=role_id, permission_id=pid))
                    assigned += 1
        else:
            for pid in new_set:
                existing = await self.db.execute(
                    select(RolePermission).where(
                        RolePermission.role_id == role_id,
                        RolePermission.permission_id == pid,
                    )
                )
                if existing.scalar_one_or_none() is None:
                    self.db.add(RolePermission(role_id=role_id, permission_id=pid))
                    assigned += 1

        await self.db.flush()
        return {"assigned": assigned, "removed": removed}
