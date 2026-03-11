"""Super Admin mail server configuration endpoints.

All config is stored in the system_settings table as JSON values
under the 'mail_admin' category.
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel as PydanticBase
from sqlalchemy import select

from app.core.deps import DBSession, SuperAdminUser
from app.models.settings import SystemSettings

router = APIRouter()

CATEGORY = "mail_admin"


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_config(db, key: str, defaults: dict) -> dict:
    result = await db.execute(
        select(SystemSettings).where(
            SystemSettings.key == key,
            SystemSettings.category == CATEGORY,
        )
    )
    row = result.scalar_one_or_none()
    if row is None or row.value is None:
        return defaults
    try:
        return {**defaults, **json.loads(row.value)}
    except json.JSONDecodeError:
        return defaults


async def _put_config(db, key: str, data: dict) -> dict:
    result = await db.execute(
        select(SystemSettings).where(
            SystemSettings.key == key,
            SystemSettings.category == CATEGORY,
        )
    )
    row = result.scalar_one_or_none()
    value_str = json.dumps(data)
    if row is None:
        row = SystemSettings(key=key, value=value_str, category=CATEGORY)
        db.add(row)
    else:
        row.value = value_str
    await db.commit()
    return data


# ── Schemas ──────────────────────────────────────────────────────────────────

class MailServerConfig(PydanticBase):
    domain: str = "localhost"
    tls_cert_path: str = ""
    tls_key_path: str = ""
    smtp_relay_host: str = ""
    smtp_relay_port: int = 587
    smtp_relay_user: str = ""
    smtp_relay_password: str = ""
    smtp_relay_tls: bool = True


class MailPolicies(PydanticBase):
    max_attachment_size_mb: int = 25
    retention_days: int = 365
    allowed_domains: list[str] = []
    blocked_domains: list[str] = []
    max_recipients_per_message: int = 100


class MailSpamConfig(PydanticBase):
    spam_threshold: float = 5.0
    blocklist: list[str] = []
    allowlist: list[str] = []
    reject_on_spam: bool = False
    quarantine_enabled: bool = True


class MailQuotas(PydanticBase):
    default_quota_mb: int = 5120
    per_user_overrides: dict[str, int] = {}
    warn_at_percent: int = 90


# ── Mail Server Config ──────────────────────────────────────────────────────

MAIL_CONFIG_KEY = "mail_server_config"
MAIL_CONFIG_DEFAULTS = MailServerConfig().model_dump()


@router.get("/config", response_model=MailServerConfig, summary="Get mail server configuration")
async def get_mail_config(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, MAIL_CONFIG_KEY, MAIL_CONFIG_DEFAULTS)


@router.put("/config", response_model=MailServerConfig, summary="Update mail server configuration")
async def update_mail_config(
    payload: MailServerConfig,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, MAIL_CONFIG_KEY, payload.model_dump())


# ── Mail Policies ────────────────────────────────────────────────────────────

MAIL_POLICIES_KEY = "mail_policies"
MAIL_POLICIES_DEFAULTS = MailPolicies().model_dump()


@router.get("/policies", response_model=MailPolicies, summary="Get mail policies")
async def get_mail_policies(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, MAIL_POLICIES_KEY, MAIL_POLICIES_DEFAULTS)


@router.put("/policies", response_model=MailPolicies, summary="Update mail policies")
async def update_mail_policies(
    payload: MailPolicies,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, MAIL_POLICIES_KEY, payload.model_dump())


# ── Spam Configuration ───────────────────────────────────────────────────────

MAIL_SPAM_KEY = "mail_spam_config"
MAIL_SPAM_DEFAULTS = MailSpamConfig().model_dump()


@router.get("/spam", response_model=MailSpamConfig, summary="Get spam configuration")
async def get_spam_config(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, MAIL_SPAM_KEY, MAIL_SPAM_DEFAULTS)


@router.put("/spam", response_model=MailSpamConfig, summary="Update spam configuration")
async def update_spam_config(
    payload: MailSpamConfig,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, MAIL_SPAM_KEY, payload.model_dump())


# ── Mail Quotas ──────────────────────────────────────────────────────────────

MAIL_QUOTAS_KEY = "mail_quotas"
MAIL_QUOTAS_DEFAULTS = MailQuotas().model_dump()


@router.get("/quotas", response_model=MailQuotas, summary="Get mail quotas")
async def get_mail_quotas(
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _get_config(db, MAIL_QUOTAS_KEY, MAIL_QUOTAS_DEFAULTS)


@router.put("/quotas", response_model=MailQuotas, summary="Update mail quotas")
async def update_mail_quotas(
    payload: MailQuotas,
    _admin: SuperAdminUser,
    db: DBSession,
) -> Any:
    return await _put_config(db, MAIL_QUOTAS_KEY, payload.model_dump())
