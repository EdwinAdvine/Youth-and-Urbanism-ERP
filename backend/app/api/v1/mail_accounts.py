"""Mail Accounts API — multi-account management for @youthandurbanism.org emails.

Provides CRUD for mail accounts, domain validation, IMAP credential testing,
and a unified inbox endpoint across all user accounts.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession
from app.core.security import decrypt_field, encrypt_field
from app.models.mail_advanced import MailAccount
from app.models.mail_storage import MailboxMessage

router = APIRouter()


# ── Pydantic schemas ─────────────────────────────────────────────────────────


class AccountCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str


class AccountUpdate(BaseModel):
    display_name: str | None = None
    sync_enabled: bool | None = None
    is_default: bool | None = None


class AccountResponse(BaseModel):
    id: str
    email: str
    display_name: str
    provider: str
    sync_enabled: bool
    is_default: bool
    last_sync_at: str | None
    created_at: str


# ── Helpers ──────────────────────────────────────────────────────────────────


def _validate_domain(email: str) -> None:
    """Enforce @youthandurbanism.org domain restriction."""
    domain = email.split("@")[-1].lower()
    if domain != settings.MAIL_ALLOWED_DOMAIN:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Only @{settings.MAIL_ALLOWED_DOMAIN} institutional emails are allowed.",
        )


def _account_to_response(account: MailAccount) -> AccountResponse:
    return AccountResponse(
        id=str(account.id),
        email=account.email,
        display_name=account.display_name,
        provider=account.provider,
        sync_enabled=account.sync_enabled,
        is_default=account.is_default,
        last_sync_at=account.last_sync_at.isoformat() if account.last_sync_at else None,
        created_at=account.created_at.isoformat() if account.created_at else "",
    )


def _test_imap_login(host: str, port: int, email_addr: str, password: str) -> bool:
    """Test IMAP credentials by attempting login. Blocking — run in executor."""
    import imaplib

    try:
        conn = imaplib.IMAP4_SSL(host, port)
        conn.login(email_addr, password)
        conn.logout()
        return True
    except Exception:
        return False


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post(
    "/accounts",
    status_code=status.HTTP_201_CREATED,
    summary="Add an email account",
)
async def add_account(
    payload: AccountCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Add a new @youthandurbanism.org email account.

    Validates domain, tests IMAP credentials against Stalwart, encrypts
    password, stores the account, and triggers an initial sync.
    """
    email_lower = payload.email.lower()
    _validate_domain(email_lower)

    # Check for duplicate
    existing = await db.execute(
        select(MailAccount.id).where(
            MailAccount.user_id == current_user.id,
            MailAccount.email == email_lower,
        ).limit(1)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email account has already been added.",
        )

    # Test IMAP credentials
    imap_host = settings.IMAP_HOST or "stalwart"
    imap_port = settings.IMAP_PORT or 993

    loop = asyncio.get_event_loop()
    login_ok = await loop.run_in_executor(
        None, _test_imap_login, imap_host, imap_port, email_lower, payload.password
    )
    if not login_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Could not authenticate with the mail server.",
        )

    # Check if this is the user's first account
    count_result = await db.execute(
        select(func.count()).select_from(MailAccount).where(
            MailAccount.user_id == current_user.id
        )
    )
    is_first = count_result.scalar() == 0

    # Encrypt password and store
    account = MailAccount(
        user_id=current_user.id,
        provider="internal",
        email=email_lower,
        display_name=payload.display_name,
        imap_host=imap_host,
        imap_port=imap_port,
        smtp_host=settings.SMTP_HOST or "stalwart",
        smtp_port=settings.SMTP_PORT or 587,
        password_encrypted=encrypt_field(payload.password),
        sync_enabled=True,
        is_default=is_first,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    # Trigger initial sync in background
    try:
        from app.services.imap_sync import sync_account  # noqa: PLC0415

        await sync_account(db, account.id)
    except Exception:
        pass  # Initial sync failure is non-fatal

    return {
        "account": _account_to_response(account).model_dump(),
        "message": "Account added successfully.",
    }


@router.get("/accounts", summary="List email accounts")
async def list_accounts(
    current_user: CurrentUser,
    db: DBSession,
) -> list[dict[str, Any]]:
    """List all email accounts for the current user."""
    result = await db.execute(
        select(MailAccount)
        .where(MailAccount.user_id == current_user.id)
        .order_by(MailAccount.is_default.desc(), MailAccount.created_at)
    )
    accounts = result.scalars().all()
    return [_account_to_response(a).model_dump() for a in accounts]


@router.get("/accounts/{account_id}", summary="Get email account details")
async def get_account(
    account_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Get a single email account's details (without password)."""
    result = await db.execute(
        select(MailAccount).where(
            MailAccount.id == account_id,
            MailAccount.user_id == current_user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return _account_to_response(account).model_dump()


@router.patch("/accounts/{account_id}", summary="Update email account")
async def update_account(
    account_id: uuid.UUID,
    payload: AccountUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Update display name, sync_enabled, or is_default for an account."""
    result = await db.execute(
        select(MailAccount).where(
            MailAccount.id == account_id,
            MailAccount.user_id == current_user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if payload.display_name is not None:
        account.display_name = payload.display_name
    if payload.sync_enabled is not None:
        account.sync_enabled = payload.sync_enabled
    if payload.is_default is not None and payload.is_default:
        # Unset all other defaults for this user first
        await db.execute(
            update(MailAccount)
            .where(MailAccount.user_id == current_user.id)
            .values(is_default=False)
        )
        account.is_default = True

    await db.commit()
    await db.refresh(account)
    return _account_to_response(account).model_dump()


@router.delete("/accounts/{account_id}", summary="Remove email account")
async def delete_account(
    account_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
    purge_messages: bool = Query(False, description="Also delete synced messages"),
) -> dict[str, str]:
    """Remove an email account and optionally purge all its synced messages."""
    result = await db.execute(
        select(MailAccount).where(
            MailAccount.id == account_id,
            MailAccount.user_id == current_user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    was_default = account.is_default

    if purge_messages:
        await db.execute(
            delete(MailboxMessage).where(
                MailboxMessage.account_id == account_id,
                MailboxMessage.user_id == current_user.id,
            )
        )

    await db.delete(account)

    # If the deleted account was default, promote the next one
    if was_default:
        next_result = await db.execute(
            select(MailAccount)
            .where(MailAccount.user_id == current_user.id)
            .order_by(MailAccount.created_at)
            .limit(1)
        )
        next_account = next_result.scalar_one_or_none()
        if next_account:
            next_account.is_default = True

    await db.commit()
    return {"detail": "Account removed successfully."}


@router.post("/accounts/{account_id}/test", summary="Test account connection")
async def test_account(
    account_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Test IMAP connectivity for an existing account."""
    result = await db.execute(
        select(MailAccount).where(
            MailAccount.id == account_id,
            MailAccount.user_id == current_user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    password = decrypt_field(account.password_encrypted) if account.password_encrypted else ""
    loop = asyncio.get_event_loop()
    ok = await loop.run_in_executor(
        None,
        _test_imap_login,
        account.imap_host or "stalwart",
        account.imap_port or 993,
        account.email,
        password,
    )

    return {
        "account_id": str(account_id),
        "imap_ok": ok,
        "message": "Connection successful" if ok else "Connection failed — check credentials",
    }


@router.post("/accounts/{account_id}/sync", summary="Trigger immediate sync")
async def sync_account_now(
    account_id: uuid.UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    """Trigger an immediate IMAP sync for one account."""
    result = await db.execute(
        select(MailAccount).where(
            MailAccount.id == account_id,
            MailAccount.user_id == current_user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    from app.services.imap_sync import sync_account  # noqa: PLC0415

    sync_result = await sync_account(db, account.id)
    return {
        "account_id": str(account_id),
        "synced": sync_result.get("synced", 0),
        "errors": sync_result.get("errors", 0),
    }


@router.get("/accounts/unified-inbox", summary="Unified inbox across all accounts")
async def unified_inbox(
    current_user: CurrentUser,
    db: DBSession,
    folder: str = Query("INBOX", description="Folder name"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    account_id: str | None = Query(None, description="Filter to specific account"),
) -> dict[str, Any]:
    """Fetch messages across all accounts in a unified view."""
    query = (
        select(MailboxMessage)
        .where(
            MailboxMessage.user_id == current_user.id,
            MailboxMessage.is_deleted == False,  # noqa: E712
            MailboxMessage.folder == folder,
        )
    )

    if account_id:
        query = query.where(MailboxMessage.account_id == uuid.UUID(account_id))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Fetch page
    query = query.order_by(MailboxMessage.received_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    messages = result.scalars().all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "messages": [
            {
                "id": str(m.id),
                "account_id": str(m.account_id) if m.account_id else None,
                "folder": m.folder,
                "from_addr": m.from_addr,
                "from_name": m.from_name,
                "to_addrs": m.to_addrs,
                "cc": m.cc,
                "subject": m.subject,
                "body_text": m.body_text[:200] if m.body_text else "",
                "is_read": m.is_read,
                "is_starred": m.is_starred,
                "is_pinned": getattr(m, "is_pinned", False),
                "received_at": m.received_at.isoformat() if m.received_at else None,
                "attachments": m.attachments or [],
                "ai_category": getattr(m, "ai_category", None),
                "priority_score": getattr(m, "priority_score", None),
            }
            for m in messages
        ],
    }
