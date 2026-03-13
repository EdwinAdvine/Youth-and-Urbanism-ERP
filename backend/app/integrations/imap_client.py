"""Async IMAP client for fetching emails from an external mail server.

Wraps the ``aioimaplib`` library to provide non-blocking IMAP access with
full RFC 2822 message parsing, including MIME body extraction and attachment
handling.

Connection:
    Connects to the mail server configured via ``settings.IMAP_HOST``,
    ``settings.IMAP_PORT``, ``settings.IMAP_USER``, and
    ``settings.IMAP_PASSWORD``.  SSL/TLS is controlled by
    ``settings.IMAP_USE_SSL``.  Each public function creates a fresh
    connection, performs its work, and logs out — there is no persistent
    connection pool (safe for Celery workers and request handlers alike).

Used by:
    - ``api/v1/mail.py`` — Mail module REST endpoints (list, read, move,
      delete, star messages)
    - ``tasks/celery_app.py`` — periodic email sync task
    - ``api/v1/mail_ext.py`` — cross-module mail integrations (Drive, CRM,
      Projects, Notes)

Public functions:
    - :func:`list_folders`      — list all IMAP mailboxes
    - :func:`fetch_messages`    — paginated message summaries from a folder
    - :func:`get_message`       — full message by UID (headers + body + attachments)
    - :func:`get_attachment`    — download a single attachment by index
    - :func:`move_message`      — COPY + delete (standard IMAP move)
    - :func:`delete_message`    — flag as \\Deleted + EXPUNGE
    - :func:`mark_read`         — set \\Seen flag
    - :func:`mark_starred`      — toggle \\Flagged flag
"""
from __future__ import annotations

import email
import email.header
import email.policy
import email.utils
import logging
from datetime import datetime, timezone
from typing import Any

import aioimaplib

from app.core.config import settings

logger = logging.getLogger(__name__)


def _decode_header(raw: str | None) -> str:
    """Decode RFC 2047 encoded header value into a plain string.

    RFC 2047 allows non-ASCII text in headers via encoded-words like
    ``=?utf-8?Q?...?=``.  This function decodes each segment and joins
    them with a single space, falling back to UTF-8 when the charset is
    not specified.
    """
    if not raw:
        return ""
    # email.header.decode_header returns a list of (bytes|str, charset|None)
    decoded_parts = email.header.decode_header(raw)
    result = []
    for part, charset in decoded_parts:
        if isinstance(part, bytes):
            # Use the advertised charset; default to UTF-8 for safety
            result.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(part)
    return " ".join(result)


def _parse_address(addr_str: str | None) -> list[dict[str, str]]:
    """Parse an email address header into a list of ``{"name", "email"}`` dicts.

    Handles comma-separated addresses and RFC 2822 display-name quoting.
    Entries with an empty email address are silently dropped.
    """
    if not addr_str:
        return []
    # getaddresses handles groups, quoted display names, and multiple addrs
    addresses = email.utils.getaddresses([addr_str])
    return [{"name": name, "email": addr} for name, addr in addresses if addr]


def _parse_date(date_str: str | None) -> datetime | None:
    """Parse an email Date header into a timezone-aware datetime.

    If the date string lacks timezone info, UTC is assumed.  Malformed
    date strings return ``None`` rather than raising — callers should
    treat ``None`` as "date unknown".
    """
    if not date_str:
        return None
    try:
        parsed = email.utils.parsedate_to_datetime(date_str)
        # Ensure the result is always tz-aware for consistent comparisons
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except Exception:
        return None


def _extract_body_and_attachments(
    msg: email.message.Message,
) -> dict[str, Any]:
    """Walk a MIME message tree and extract text/html bodies and attachment metadata.

    For multipart messages, the function iterates over all MIME parts:
    - Parts with ``Content-Disposition: attachment`` are collected as
      attachment metadata (filename, type, size, Content-ID).
    - The first ``text/plain`` part becomes ``body_text``.
    - The first ``text/html`` part becomes ``body_html``.

    For single-part messages the payload is treated as either HTML or
    plain text based on the Content-Type.

    Returns
    -------
    dict
        ``{"body_text": str, "body_html": str, "attachments": list[dict]}``
    """
    body_text = ""
    body_html = ""
    attachments: list[dict[str, Any]] = []

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))

            if "attachment" in content_disposition:
                # Collect attachment metadata without loading the full body
                # into the return dict — actual download is via get_attachment()
                filename = part.get_filename() or "attachment"
                filename = _decode_header(filename)
                attachments.append({
                    "filename": filename,
                    "content_type": content_type,
                    "size": len(part.get_payload(decode=True) or b""),
                    "part_id": part.get("Content-ID", ""),
                })
            elif content_type == "text/plain" and not body_text:
                # Take only the first text/plain part (avoid duplicates
                # from multipart/alternative structures)
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                body_text = payload.decode(charset, errors="replace") if payload else ""
            elif content_type == "text/html" and not body_html:
                # Take only the first text/html part
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                body_html = payload.decode(charset, errors="replace") if payload else ""
    else:
        # Single-part message — classify by Content-Type
        content_type = msg.get_content_type()
        payload = msg.get_payload(decode=True)
        charset = msg.get_content_charset() or "utf-8"
        decoded = payload.decode(charset, errors="replace") if payload else ""
        if content_type == "text/html":
            body_html = decoded
        else:
            body_text = decoded

    return {
        "body_text": body_text,
        "body_html": body_html,
        "attachments": attachments,
    }


def _parse_email_message(raw_bytes: bytes, uid: str) -> dict[str, Any]:
    """Parse raw email bytes into a structured dict suitable for API responses.

    Combines header extraction, body parsing, and attachment metadata into a
    single flat dict keyed by standard fields (subject, from, to, cc, bcc,
    date, in_reply_to, references, body_text, body_html, attachments, headers).
    """
    # Use the "default" email policy for modern header handling (returns str)
    msg = email.message_from_bytes(raw_bytes, policy=email.policy.default)

    bodies = _extract_body_and_attachments(msg)

    # Collect all raw headers into a dict for debugging / advanced UI display
    headers: dict[str, str] = {}
    for key in msg.keys():
        headers[key] = str(msg[key])

    return {
        "uid": uid,
        "message_id_header": str(msg.get("Message-ID", "")),
        "subject": _decode_header(msg.get("Subject")),
        "from": _parse_address(msg.get("From")),
        "to": _parse_address(msg.get("To")),
        "cc": _parse_address(msg.get("Cc")),
        "bcc": _parse_address(msg.get("Bcc")),
        "date": _parse_date(msg.get("Date")),
        "in_reply_to": str(msg.get("In-Reply-To", "")),
        "references": str(msg.get("References", "")),
        "body_text": bodies["body_text"],
        "body_html": bodies["body_html"],
        "attachments": bodies["attachments"],
        "headers": headers,
    }


async def _get_client() -> aioimaplib.IMAP4_SSL | aioimaplib.IMAP4:
    """Create and authenticate an IMAP client connection.

    Reads connection details from ``app.core.config.settings``:
    - ``IMAP_HOST`` / ``IMAP_PORT`` — server address
    - ``IMAP_USE_SSL`` — whether to use IMAP4_SSL (port 993) or plain IMAP4
    - ``IMAP_USER`` / ``IMAP_PASSWORD`` — login credentials

    The caller is responsible for calling ``await client.logout()`` when done.
    All public functions in this module use a try/finally pattern to ensure
    logout even on error.
    """
    # Choose SSL vs plaintext transport based on configuration
    if settings.IMAP_USE_SSL:
        client = aioimaplib.IMAP4_SSL(
            host=settings.IMAP_HOST,
            port=settings.IMAP_PORT,
            timeout=30,
        )
    else:
        client = aioimaplib.IMAP4(
            host=settings.IMAP_HOST,
            port=settings.IMAP_PORT,
            timeout=30,
        )

    # Wait for the server greeting before attempting authentication
    await client.wait_hello_from_server()
    await client.login(settings.IMAP_USER, settings.IMAP_PASSWORD)
    return client


async def list_folders() -> dict[str, Any]:
    """List all IMAP folders/mailboxes.

    Returns
    -------
    dict
        ``{"success": bool, "folders": [{"name": str, "delimiter": str, "flags": str}], "error": str | None}``
    """
    try:
        client = await _get_client()
        try:
            response = await client.list("", "*")
            if response.result != "OK":
                return {"success": False, "folders": [], "error": f"LIST failed: {response.result}"}

            folders = []
            for line in response.lines:
                if not line or line == b")":
                    continue
                line_str = line.decode("utf-8", errors="replace") if isinstance(line, bytes) else str(line)
                # Parse IMAP LIST response: (flags) "delimiter" "name"
                if '"' in line_str:
                    parts = line_str.split('"')
                    if len(parts) >= 4:
                        flags = parts[0].strip().strip("()")
                        delimiter = parts[1]
                        folder_name = parts[3] if len(parts) > 3 else parts[-1]
                        folders.append({
                            "name": folder_name.strip(),
                            "delimiter": delimiter,
                            "flags": flags,
                        })
                    elif len(parts) >= 2:
                        folders.append({
                            "name": parts[-1].strip() or parts[-2].strip(),
                            "delimiter": "/",
                            "flags": "",
                        })

            return {"success": True, "folders": folders, "error": None}
        finally:
            await client.logout()
    except Exception as exc:
        logger.error("IMAP list_folders failed: %s", exc)
        return {"success": False, "folders": [], "error": str(exc)}


async def fetch_messages(
    folder: str = "INBOX",
    since_date: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """Fetch message summaries from an IMAP folder.

    Parameters
    ----------
    folder : str
        IMAP folder name (e.g., ``INBOX``, ``Sent``, ``Drafts``).
    since_date : str | None
        Fetch messages since this date (format: ``DD-Mon-YYYY``, e.g. ``01-Jan-2026``).
    limit : int
        Maximum number of messages to return.
    offset : int
        Number of messages to skip (for pagination).

    Returns
    -------
    dict
        ``{"success": bool, "total": int, "messages": [...], "error": str | None}``
    """
    try:
        client = await _get_client()
        try:
            response = await client.select(folder)
            if response.result != "OK":
                return {"success": False, "total": 0, "messages": [], "error": f"SELECT failed: {response.result}"}

            # Search for messages
            if since_date:
                search_resp = await client.search(f"SINCE {since_date}")
            else:
                search_resp = await client.search("ALL")

            if search_resp.result != "OK":
                return {"success": False, "total": 0, "messages": [], "error": f"SEARCH failed: {search_resp.result}"}

            # Parse UIDs from search result
            uid_line = search_resp.lines[0] if search_resp.lines else b""
            if isinstance(uid_line, bytes):
                uid_line = uid_line.decode("utf-8", errors="replace")
            uid_list = uid_line.strip().split() if uid_line.strip() else []

            total = len(uid_list)

            # Apply pagination (newest first)
            uid_list.reverse()
            paginated_uids = uid_list[offset : offset + limit]

            if not paginated_uids:
                return {"success": True, "total": total, "messages": [], "error": None}

            # Fetch headers for the paginated UIDs
            uid_range = ",".join(paginated_uids)
            fetch_resp = await client.fetch(
                uid_range,
                "(FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)])",
            )

            messages = []
            if fetch_resp.result == "OK":
                # Parse fetch responses — aioimaplib returns lines
                i = 0
                while i < len(fetch_resp.lines):
                    line = fetch_resp.lines[i]
                    if isinstance(line, bytes) and b"FETCH" in line:
                        # Extract UID from the response line
                        line_str = line.decode("utf-8", errors="replace")
                        uid = ""
                        parts = line_str.split()
                        for idx, p in enumerate(parts):
                            if p.isdigit() and idx == 0:
                                uid = p
                                break

                        # Next line(s) should be the header data
                        header_data = b""
                        i += 1
                        while i < len(fetch_resp.lines):
                            next_line = fetch_resp.lines[i]
                            if isinstance(next_line, bytes) and (b"FETCH" in next_line or next_line == b")"):
                                break
                            if isinstance(next_line, bytes):
                                header_data += next_line + b"\r\n"
                            i += 1

                        if header_data:
                            hdr_msg = email.message_from_bytes(header_data, policy=email.policy.default)

                            # Check flags for \Seen
                            is_read = "\\Seen" in line_str if isinstance(line_str, str) else False
                            is_starred = "\\Flagged" in line_str if isinstance(line_str, str) else False

                            messages.append({
                                "uid": uid,
                                "subject": _decode_header(hdr_msg.get("Subject")),
                                "from": _parse_address(hdr_msg.get("From")),
                                "to": _parse_address(hdr_msg.get("To")),
                                "date": _parse_date(hdr_msg.get("Date")),
                                "message_id": str(hdr_msg.get("Message-ID", "")),
                                "is_read": is_read,
                                "is_starred": is_starred,
                            })
                    else:
                        i += 1

            return {"success": True, "total": total, "messages": messages, "error": None}
        finally:
            await client.logout()
    except Exception as exc:
        logger.error("IMAP fetch_messages failed: %s", exc)
        return {"success": False, "total": 0, "messages": [], "error": str(exc)}


async def get_message(uid: str, folder: str = "INBOX") -> dict[str, Any]:
    """Fetch a complete email message by UID.

    Parameters
    ----------
    uid : str
        IMAP UID of the message.
    folder : str
        Folder the message is in.

    Returns
    -------
    dict
        ``{"success": bool, "message": dict | None, "error": str | None}``
    """
    try:
        client = await _get_client()
        try:
            await client.select(folder)
            fetch_resp = await client.fetch(uid, "(FLAGS BODY[])")

            if fetch_resp.result != "OK":
                return {"success": False, "message": None, "error": f"FETCH failed: {fetch_resp.result}"}

            # Find the raw email data in the response
            raw_data = b""
            for line in fetch_resp.lines:
                if isinstance(line, bytes) and len(line) > 100:
                    raw_data = line
                    break

            if not raw_data:
                # Try concatenating all non-metadata lines
                for line in fetch_resp.lines:
                    if isinstance(line, bytes) and b"FETCH" not in line and line != b")":
                        raw_data += line + b"\r\n"

            if not raw_data:
                return {"success": True, "message": None, "error": "Empty message"}

            parsed = _parse_email_message(raw_data, uid)
            return {"success": True, "message": parsed, "error": None}
        finally:
            await client.logout()
    except Exception as exc:
        logger.error("IMAP get_message failed: %s", exc)
        return {"success": False, "message": None, "error": str(exc)}


async def get_attachment(
    uid: str,
    attachment_index: int,
    folder: str = "INBOX",
) -> dict[str, Any]:
    """Download a specific attachment from a message by UID and attachment index.

    Returns
    -------
    dict
        ``{"success": bool, "data": bytes | None, "filename": str, "content_type": str}``
    """
    try:
        client = await _get_client()
        try:
            await client.select(folder)
            fetch_resp = await client.fetch(uid, "(BODY[])")

            if fetch_resp.result != "OK":
                return {"success": False, "data": None, "filename": "", "content_type": ""}

            raw_data = b""
            for line in fetch_resp.lines:
                if isinstance(line, bytes) and len(line) > 100:
                    raw_data = line
                    break
            if not raw_data:
                for line in fetch_resp.lines:
                    if isinstance(line, bytes) and b"FETCH" not in line and line != b")":
                        raw_data += line + b"\r\n"

            if not raw_data:
                return {"success": False, "data": None, "filename": "", "content_type": ""}

            msg = email.message_from_bytes(raw_data, policy=email.policy.default)

            idx = 0
            for part in msg.walk():
                content_disposition = str(part.get("Content-Disposition", ""))
                if "attachment" in content_disposition:
                    if idx == attachment_index:
                        filename = part.get_filename() or "attachment"
                        filename = _decode_header(filename)
                        data = part.get_payload(decode=True) or b""
                        return {
                            "success": True,
                            "data": data,
                            "filename": filename,
                            "content_type": part.get_content_type(),
                            "size": len(data),
                        }
                    idx += 1

            return {"success": False, "data": None, "filename": "", "content_type": ""}
        finally:
            await client.logout()
    except Exception as exc:
        logger.error("IMAP get_attachment failed: %s", exc)
        return {"success": False, "data": None, "filename": "", "content_type": ""}


async def move_message(uid: str, from_folder: str, to_folder: str) -> dict[str, Any]:
    """Move a message from one folder to another.

    Uses COPY + flag as deleted + EXPUNGE (standard IMAP move).
    """
    try:
        client = await _get_client()
        try:
            await client.select(from_folder)

            # Copy to destination
            copy_resp = await client.copy(uid, to_folder)
            if copy_resp.result != "OK":
                return {"success": False, "error": f"COPY failed: {copy_resp.result}"}

            # Mark original as deleted
            await client.store(uid, "+FLAGS", "(\\Deleted)")
            await client.expunge()

            return {"success": True, "error": None}
        finally:
            await client.logout()
    except Exception as exc:
        logger.error("IMAP move_message failed: %s", exc)
        return {"success": False, "error": str(exc)}


async def delete_message(uid: str, folder: str = "INBOX") -> dict[str, Any]:
    """Delete a message by marking it as deleted and expunging."""
    try:
        client = await _get_client()
        try:
            await client.select(folder)
            await client.store(uid, "+FLAGS", "(\\Deleted)")
            await client.expunge()
            return {"success": True, "error": None}
        finally:
            await client.logout()
    except Exception as exc:
        logger.error("IMAP delete_message failed: %s", exc)
        return {"success": False, "error": str(exc)}


async def mark_read(uid: str, folder: str = "INBOX") -> dict[str, Any]:
    """Mark a message as read (set \\Seen flag)."""
    try:
        client = await _get_client()
        try:
            await client.select(folder)
            await client.store(uid, "+FLAGS", "(\\Seen)")
            return {"success": True, "error": None}
        finally:
            await client.logout()
    except Exception as exc:
        logger.error("IMAP mark_read failed: %s", exc)
        return {"success": False, "error": str(exc)}


async def mark_starred(uid: str, folder: str = "INBOX", starred: bool = True) -> dict[str, Any]:
    """Toggle the \\Flagged (starred) flag on a message."""
    try:
        client = await _get_client()
        try:
            await client.select(folder)
            op = "+FLAGS" if starred else "-FLAGS"
            await client.store(uid, op, "(\\Flagged)")
            return {"success": True, "error": None}
        finally:
            await client.logout()
    except Exception as exc:
        logger.error("IMAP mark_starred failed: %s", exc)
        return {"success": False, "error": str(exc)}
