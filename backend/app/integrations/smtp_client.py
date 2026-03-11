"""Async SMTP client for sending emails.

Uses ``aiosmtplib`` for non-blocking SMTP delivery with full MIME support
(HTML + plain text + file attachments).
"""
from __future__ import annotations

import logging
import uuid
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid
from typing import Any

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(
    from_addr: str,
    to_addrs: list[str],
    subject: str,
    body_html: str | None = None,
    body_text: str | None = None,
    cc: list[str] | None = None,
    bcc: list[str] | None = None,
    attachments: list[dict[str, Any]] | None = None,
    in_reply_to: str | None = None,
    references: str | None = None,
    from_name: str | None = None,
) -> dict[str, Any]:
    """Send an email via the configured SMTP server.

    Parameters
    ----------
    from_addr : str
        Sender email address.
    to_addrs : list[str]
        List of recipient email addresses.
    subject : str
        Email subject line.
    body_html : str | None
        HTML body content.
    body_text : str | None
        Plain text body content.
    cc : list[str] | None
        Carbon copy recipients.
    bcc : list[str] | None
        Blind carbon copy recipients.
    attachments : list[dict] | None
        Each dict should have ``filename`` (str), ``content`` (bytes), and
        optionally ``content_type`` (str, default ``application/octet-stream``).
    in_reply_to : str | None
        Message-ID of the message being replied to.
    references : str | None
        References header value for threading.
    from_name : str | None
        Display name for the sender.

    Returns
    -------
    dict
        ``{"success": bool, "message_id": str | None, "error": str | None}``
    """
    try:
        # Build the MIME message
        msg = MIMEMultipart("mixed")
        msg["From"] = formataddr((from_name or "", from_addr))
        msg["To"] = ", ".join(to_addrs)
        if cc:
            msg["Cc"] = ", ".join(cc)
        msg["Subject"] = subject
        msg["Date"] = formatdate(localtime=True)

        message_id = make_msgid(domain=settings.MAIL_DOMAIN)
        msg["Message-ID"] = message_id

        if in_reply_to:
            msg["In-Reply-To"] = in_reply_to
        if references:
            msg["References"] = references

        # Build the alternative body (text + HTML)
        body_part = MIMEMultipart("alternative")

        if body_text:
            body_part.attach(MIMEText(body_text, "plain", "utf-8"))
        elif body_html:
            # Generate a basic text fallback from HTML presence
            body_part.attach(MIMEText("Please view this email in an HTML-capable client.", "plain", "utf-8"))

        if body_html:
            body_part.attach(MIMEText(body_html, "html", "utf-8"))
        elif body_text and not body_html:
            # Only plain text — already attached above
            pass

        msg.attach(body_part)

        # Attach files
        if attachments:
            for att in attachments:
                filename = att.get("filename", f"attachment-{uuid.uuid4().hex[:8]}")
                content = att.get("content", b"")
                content_type = att.get("content_type", "application/octet-stream")

                maintype, _, subtype = content_type.partition("/")
                part = MIMEApplication(content, _subtype=subtype or "octet-stream")
                part.add_header("Content-Disposition", "attachment", filename=filename)
                msg.attach(part)

        # Compute all recipients
        all_recipients = list(to_addrs)
        if cc:
            all_recipients.extend(cc)
        if bcc:
            all_recipients.extend(bcc)

        # Send via SMTP
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            use_tls=settings.SMTP_USE_TLS,
            start_tls=not settings.SMTP_USE_TLS and settings.SMTP_PORT in (587,),
            recipients=all_recipients,
        )

        logger.info("Email sent from %s to %s, subject=%s", from_addr, to_addrs, subject)
        return {"success": True, "message_id": message_id, "error": None}

    except aiosmtplib.SMTPException as exc:
        logger.error("SMTP error sending email: %s", exc)
        return {"success": False, "message_id": None, "error": f"SMTP error: {exc}"}
    except Exception as exc:
        logger.error("Unexpected error sending email: %s", exc)
        return {"success": False, "message_id": None, "error": str(exc)}
