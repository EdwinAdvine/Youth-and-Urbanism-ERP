"""IMAP sync service for external mail account synchronization."""
from __future__ import annotations

import asyncio
import email
import imaplib
import logging
import uuid
from datetime import datetime, timezone
from email.header import decode_header
from email.utils import parseaddr, parsedate_to_datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ── Header / address helpers ──────────────────────────────────────────────────


def _decode_header_value(value: str | None) -> str:
    """Decode RFC 2047 encoded header values."""
    if not value:
        return ""
    decoded_parts = decode_header(value)
    result: list[str] = []
    for part, charset in decoded_parts:
        if isinstance(part, bytes):
            result.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(str(part))
    return " ".join(result)


def _parse_address(addr_str: str) -> dict[str, str]:
    """Parse a single email address string into {name, email}."""
    name, email_addr = parseaddr(addr_str)
    return {"name": _decode_header_value(name), "email": email_addr}


def _parse_addresses(header_value: str | None) -> list[dict[str, str]]:
    """Parse a comma-separated address header into a list of {name, email}."""
    if not header_value:
        return []
    parts = header_value.split(",")
    return [_parse_address(p.strip()) for p in parts if p.strip()]


# ── Body extraction ───────────────────────────────────────────────────────────


def _extract_body(msg: email.message.Message) -> tuple[str, str]:
    """Walk a MIME message and extract text/plain and text/html payloads."""
    text_body = ""
    html_body = ""

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))

            if "attachment" in content_disposition:
                continue

            try:
                payload = part.get_payload(decode=True)
                if payload is None:
                    continue
                charset = part.get_content_charset() or "utf-8"
                decoded = payload.decode(charset, errors="replace")
            except Exception:
                continue

            if content_type == "text/plain" and not text_body:
                text_body = decoded
            elif content_type == "text/html" and not html_body:
                html_body = decoded
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                decoded = payload.decode(charset, errors="replace")
                if msg.get_content_type() == "text/html":
                    html_body = decoded
                else:
                    text_body = decoded
        except Exception:
            pass

    return text_body, html_body


# ── Attachment metadata ───────────────────────────────────────────────────────


def _extract_attachments(msg: email.message.Message) -> list[dict[str, Any]]:
    """Extract attachment metadata (filename, content_type, size) from a MIME message."""
    attachments: list[dict[str, Any]] = []

    if not msg.is_multipart():
        return attachments

    for part in msg.walk():
        content_disposition = str(part.get("Content-Disposition", ""))
        if "attachment" not in content_disposition and "inline" not in content_disposition:
            continue

        filename = part.get_filename()
        if not filename:
            continue

        filename = _decode_header_value(filename)
        content_type = part.get_content_type()
        payload = part.get_payload(decode=True)
        size = len(payload) if payload else 0

        attachments.append({
            "filename": filename,
            "content_type": content_type,
            "size": size,
            "storage_key": "",  # Populated when saved to MinIO
        })

    return attachments


# ── Full email parser ─────────────────────────────────────────────────────────


def _parse_email(raw_bytes: bytes) -> dict[str, Any]:
    """Parse raw email bytes into a structured dict.

    Returns dict with keys: from_addr, from_name, to_addrs, cc, subject,
    body_text, body_html, message_id_header, in_reply_to, references,
    received_at, attachments.
    """
    msg = email.message_from_bytes(raw_bytes)

    from_parsed = _parse_address(msg.get("From", ""))
    to_addrs = _parse_addresses(msg.get("To", ""))
    cc = _parse_addresses(msg.get("Cc", ""))
    subject = _decode_header_value(msg.get("Subject", ""))
    text_body, html_body = _extract_body(msg)
    attachments = _extract_attachments(msg)

    # Parse received date
    date_str = msg.get("Date", "")
    try:
        received_at = parsedate_to_datetime(date_str) if date_str else datetime.now(timezone.utc)
    except Exception:
        received_at = datetime.now(timezone.utc)

    if received_at.tzinfo is None:
        received_at = received_at.replace(tzinfo=timezone.utc)

    return {
        "from_addr": from_parsed.get("email", ""),
        "from_name": from_parsed.get("name", ""),
        "to_addrs": to_addrs,
        "cc": cc,
        "subject": subject,
        "body_text": text_body,
        "body_html": html_body,
        "message_id_header": msg.get("Message-ID", ""),
        "in_reply_to": msg.get("In-Reply-To", ""),
        "references": msg.get("References", ""),
        "received_at": received_at,
        "attachments": attachments,
    }


# ── IMAP connection ───────────────────────────────────────────────────────────


def _connect_imap(host: str, port: int, email_addr: str, password: str) -> imaplib.IMAP4_SSL:
    """Connect to an IMAP server over SSL and authenticate."""
    conn = imaplib.IMAP4_SSL(host, port)
    conn.login(email_addr, password)
    return conn


# ── Blocking fetch (runs in executor) ─────────────────────────────────────────


def _fetch_new_messages(
    host: str,
    port: int,
    email_addr: str,
    password: str,
    since_date: str | None,
    folder: str = "INBOX",
    limit: int = 100,
) -> list[bytes]:
    """Fetch raw email bytes from IMAP since *since_date* (IMAP date string).

    This is a blocking function intended to be run in an executor.
    """
    conn = _connect_imap(host, port, email_addr, password)
    try:
        conn.select(folder)

        if since_date:
            status, message_ids = conn.search(None, f'(SINCE "{since_date}")')
        else:
            status, message_ids = conn.search(None, "ALL")

        if status != "OK" or not message_ids or not message_ids[0]:
            return []

        id_list = message_ids[0].split()
        # Take the most recent N
        recent_ids = id_list[-limit:] if len(id_list) > limit else id_list

        raw_messages: list[bytes] = []
        for msg_id in reversed(recent_ids):
            try:
                status, msg_data = conn.fetch(msg_id, "(RFC822)")
                if status == "OK" and msg_data and msg_data[0]:
                    raw = msg_data[0][1]
                    if isinstance(raw, bytes):
                        raw_messages.append(raw)
            except Exception as exc:
                logger.warning("Failed to fetch IMAP message %s: %s", msg_id, exc)

        return raw_messages
    finally:
        try:
            conn.logout()
        except Exception:
            pass


# ── Main async entry point ────────────────────────────────────────────────────


async def sync_account(db: AsyncSession, account_id: uuid.UUID) -> dict[str, Any]:
    """Sync an external mail account via IMAP.

    Loads the MailAccount from the database, connects via IMAP, fetches new
    messages since ``last_sync_at``, stores them as MailboxMessage records,
    and updates the account's ``last_sync_at`` timestamp.

    Returns a summary dict: {synced, errors, error?}.
    """
    from app.models.mail_advanced import MailAccount
    from app.models.mail_storage import MailboxMessage

    # Load account
    result = await db.execute(
        select(MailAccount).where(MailAccount.id == account_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        return {"synced": 0, "errors": 0, "error": "Account not found"}

    if not account.sync_enabled:
        return {"synced": 0, "errors": 0, "error": "Sync disabled for this account"}

    # Compute IMAP since-date from last_sync_at
    since_date: str | None = None
    if account.last_sync_at:
        since_date = account.last_sync_at.strftime("%d-%b-%Y")

    host = account.imap_host
    port = account.imap_port
    email_addr = account.email

    # Decrypt password / extract from OAuth tokens
    password = ""
    if account.oauth_tokens and isinstance(account.oauth_tokens, dict):
        password = account.oauth_tokens.get("password", "")

    if not host or not password:
        return {"synced": 0, "errors": 0, "error": "Missing IMAP credentials"}

    # Run blocking IMAP fetch in an executor
    try:
        loop = asyncio.get_event_loop()
        raw_messages: list[bytes] = await loop.run_in_executor(
            None, _fetch_new_messages, host, port, email_addr, password, since_date
        )
    except Exception as exc:
        logger.error("IMAP fetch failed for account %s: %s", account_id, exc)
        return {"synced": 0, "errors": 1, "error": str(exc)}

    new_count = 0
    error_count = 0

    for raw in raw_messages:
        try:
            parsed = _parse_email(raw)

            message_id_header = parsed["message_id_header"]

            # Skip duplicates
            existing = await db.execute(
                select(MailboxMessage.id).where(
                    MailboxMessage.user_id == account.user_id,
                    MailboxMessage.message_id_header == message_id_header,
                ).limit(1)
            )
            if existing.scalar_one_or_none():
                continue

            new_msg = MailboxMessage(
                user_id=account.user_id,
                account_id=account_id,
                folder="INBOX",
                from_addr=parsed["from_addr"],
                from_name=parsed["from_name"],
                to_addrs=parsed["to_addrs"],
                cc=parsed["cc"],
                bcc=[],
                subject=parsed["subject"],
                body_html=parsed["body_html"],
                body_text=parsed["body_text"],
                message_id_header=message_id_header,
                in_reply_to=parsed["in_reply_to"] or "",
                references=parsed["references"] or "",
                received_at=parsed["received_at"],
                attachments=parsed["attachments"],
                is_read=False,
            )
            db.add(new_msg)
            new_count += 1

        except Exception as exc:
            logger.error("Failed to parse/store IMAP message: %s", exc)
            error_count += 1

    # Update last_sync_at
    account.last_sync_at = datetime.now(timezone.utc)

    try:
        await db.commit()
    except Exception as exc:
        logger.error("Failed to commit IMAP sync batch for account %s: %s", account_id, exc)
        await db.rollback()
        return {"synced": 0, "errors": error_count + 1, "error": str(exc)}

    logger.info(
        "IMAP sync complete for account %s (%s): %d new, %d errors",
        account_id, email_addr, new_count, error_count,
    )
    return {"synced": new_count, "errors": error_count}
