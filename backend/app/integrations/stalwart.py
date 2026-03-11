"""Stalwart Mail Server integration via its HTTP management / JMAP API.

Stalwart exposes a JMAP (RFC 8620 / RFC 8621) HTTP API.  This module provides
thin async wrappers around the most common operations:

- list mailbox folders
- list messages in a folder
- fetch a full message
- send a message (JMAP submission)

All network calls use ``httpx.AsyncClient``.  When Stalwart is not reachable or
not configured the helpers return graceful empty-list / False responses rather
than raising exceptions.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Stalwart JMAP endpoint
_JMAP_BASE = f"{settings.STALWART_URL}/jmap"
_JMAP_CAPABILITIES = "urn:ietf:params:jmap:core"
_TIMEOUT = httpx.Timeout(10.0)


def _is_configured() -> bool:
    """Return True when STALWART_URL looks like a real address (not empty / default placeholder)."""
    url = settings.STALWART_URL.strip()
    return bool(url) and url not in ("", "http://stalwart:8080")


def _auth_headers(user_email: str) -> dict[str, str]:
    """Build basic-auth headers for a mailbox user.

    In production each user's password should be retrieved from a secure
    credential store.  For now we construct a deterministic token; replace
    this with real credential resolution for production deployments.
    """
    # TODO: replace with real per-user credential lookup
    return {
        "Authorization": f"Bearer {settings.SECRET_KEY}",
        "X-User-Email": user_email,
        "Content-Type": "application/json",
    }


async def list_folders(user_email: str) -> dict[str, Any]:
    """Return a list of JMAP Mailbox objects for ``user_email``.

    Response structure::

        {
            "service_available": bool,
            "folders": [{"id": ..., "name": ..., "role": ..., "totalEmails": ...}, ...]
        }
    """
    if not _is_configured():
        return {"service_available": False, "folders": []}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            payload = {
                "using": [_JMAP_CAPABILITIES, "urn:ietf:params:jmap:mail"],
                "methodCalls": [
                    ["Mailbox/get", {"accountId": user_email, "ids": None}, "0"],
                ],
            }
            resp = await client.post(_JMAP_BASE, json=payload, headers=_auth_headers(user_email))
            resp.raise_for_status()
            data = resp.json()
            raw: list[dict] = (
                data.get("methodResponses", [[None, {"list": []}]])[0][1].get("list", [])
            )
            folders = [
                {
                    "id": m.get("id"),
                    "name": m.get("name"),
                    "role": m.get("role"),
                    "total_emails": m.get("totalEmails", 0),
                    "unread_emails": m.get("unreadEmails", 0),
                }
                for m in raw
            ]
            return {"service_available": True, "folders": folders}
    except Exception as exc:
        logger.warning("Stalwart list_folders failed: %s", exc)
        return {"service_available": False, "folders": []}


async def list_messages(
    user_email: str,
    folder_id: str = "inbox",
    page: int = 1,
    limit: int = 50,
) -> dict[str, Any]:
    """Return a page of email summaries from ``folder_id``.

    Response structure::

        {
            "service_available": bool,
            "total": int,
            "messages": [{"id": ..., "subject": ..., "from": ..., "date": ..., "read": ...}]
        }
    """
    if not _is_configured():
        return {"service_available": False, "total": 0, "messages": []}

    try:
        offset = (page - 1) * limit
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            payload = {
                "using": [_JMAP_CAPABILITIES, "urn:ietf:params:jmap:mail"],
                "methodCalls": [
                    [
                        "Email/query",
                        {
                            "accountId": user_email,
                            "filter": {"inMailbox": folder_id},
                            "sort": [{"property": "receivedAt", "isAscending": False}],
                            "position": offset,
                            "limit": limit,
                        },
                        "0",
                    ],
                    [
                        "Email/get",
                        {
                            "accountId": user_email,
                            "#ids": {
                                "resultOf": "0",
                                "name": "Email/query",
                                "path": "/ids",
                            },
                            "properties": ["id", "subject", "from", "receivedAt", "keywords"],
                        },
                        "1",
                    ],
                ],
            }
            resp = await client.post(_JMAP_BASE, json=payload, headers=_auth_headers(user_email))
            resp.raise_for_status()
            data = resp.json()
            responses = data.get("methodResponses", [])
            total: int = 0
            messages: list[dict] = []
            for name, result, _ in responses:
                if name == "Email/query":
                    total = result.get("total", 0)
                elif name == "Email/get":
                    for email in result.get("list", []):
                        frm = email.get("from", [{}])
                        messages.append({
                            "id": email.get("id"),
                            "subject": email.get("subject", "(no subject)"),
                            "from": frm[0] if frm else {},
                            "date": email.get("receivedAt"),
                            "read": "\\Seen" in email.get("keywords", {}),
                        })
            return {"service_available": True, "total": total, "messages": messages}
    except Exception as exc:
        logger.warning("Stalwart list_messages failed: %s", exc)
        return {"service_available": False, "total": 0, "messages": []}


async def get_message(user_email: str, message_id: str) -> dict[str, Any]:
    """Fetch the full content of a single email.

    Response structure::

        {
            "service_available": bool,
            "message": {id, subject, from, to, cc, date, text_body, html_body, attachments}
        }
    """
    if not _is_configured():
        return {"service_available": False, "message": None}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            payload = {
                "using": [_JMAP_CAPABILITIES, "urn:ietf:params:jmap:mail"],
                "methodCalls": [
                    [
                        "Email/get",
                        {
                            "accountId": user_email,
                            "ids": [message_id],
                            "properties": [
                                "id", "subject", "from", "to", "cc", "bcc",
                                "receivedAt", "htmlBody", "textBody",
                                "attachments", "keywords",
                            ],
                            "fetchHTMLBodyValues": True,
                            "fetchTextBodyValues": True,
                        },
                        "0",
                    ],
                ],
            }
            resp = await client.post(_JMAP_BASE, json=payload, headers=_auth_headers(user_email))
            resp.raise_for_status()
            data = resp.json()
            emails = (
                data.get("methodResponses", [[None, {"list": []}]])[0][1].get("list", [])
            )
            if not emails:
                return {"service_available": True, "message": None}
            email = emails[0]
            body_values: dict = data.get("methodResponses", [[None, {}]])[0][1].get(
                "bodyValues", {}
            )
            text_body = ""
            html_body = ""
            for part in email.get("textBody", []):
                part_id = part.get("partId", "")
                text_body += body_values.get(part_id, {}).get("value", "")
            for part in email.get("htmlBody", []):
                part_id = part.get("partId", "")
                html_body += body_values.get(part_id, {}).get("value", "")
            return {
                "service_available": True,
                "message": {
                    "id": email.get("id"),
                    "subject": email.get("subject", "(no subject)"),
                    "from": email.get("from", []),
                    "to": email.get("to", []),
                    "cc": email.get("cc", []),
                    "bcc": email.get("bcc", []),
                    "date": email.get("receivedAt"),
                    "text_body": text_body,
                    "html_body": html_body,
                    "attachments": email.get("attachments", []),
                    "read": "\\Seen" in email.get("keywords", {}),
                },
            }
    except Exception as exc:
        logger.warning("Stalwart get_message failed: %s", exc)
        return {"service_available": False, "message": None}


async def send_message(
    from_email: str,
    to: list[str],
    subject: str,
    body: str,
    cc: list[str] | None = None,
    html_body: str | None = None,
) -> dict[str, Any]:
    """Send an email via Stalwart JMAP Email/set + EmailSubmission/set.

    Returns ``{"service_available": bool, "success": bool, "message_id": str | None}``.
    """
    if not _is_configured():
        return {"service_available": False, "success": False, "message_id": None}

    try:
        to_addresses = [{"email": addr} for addr in to]
        cc_addresses = [{"email": addr} for addr in (cc or [])]

        body_values: dict[str, Any] = {
            "text1": {"value": body, "isEncodingProblem": False, "isTruncated": False},
        }
        text_body = [{"partId": "text1", "type": "text/plain"}]
        html_parts: list[dict] = []
        if html_body:
            body_values["html1"] = {"value": html_body, "isEncodingProblem": False, "isTruncated": False}
            html_parts = [{"partId": "html1", "type": "text/html"}]

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            payload = {
                "using": [
                    _JMAP_CAPABILITIES,
                    "urn:ietf:params:jmap:mail",
                    "urn:ietf:params:jmap:submission",
                ],
                "methodCalls": [
                    [
                        "Email/set",
                        {
                            "accountId": from_email,
                            "create": {
                                "draft1": {
                                    "from": [{"email": from_email}],
                                    "to": to_addresses,
                                    "cc": cc_addresses,
                                    "subject": subject,
                                    "bodyValues": body_values,
                                    "textBody": text_body,
                                    "htmlBody": html_parts,
                                    "keywords": {"\\Draft": True},
                                }
                            },
                        },
                        "0",
                    ],
                    [
                        "EmailSubmission/set",
                        {
                            "accountId": from_email,
                            "create": {
                                "sub1": {
                                    "#emailId": {
                                        "resultOf": "0",
                                        "name": "Email/set",
                                        "path": "/created/draft1/id",
                                    },
                                    "envelope": {
                                        "mailFrom": {"email": from_email},
                                        "rcptTo": to_addresses + cc_addresses,
                                    },
                                }
                            },
                        },
                        "1",
                    ],
                ],
            }
            resp = await client.post(_JMAP_BASE, json=payload, headers=_auth_headers(from_email))
            resp.raise_for_status()
            data = resp.json()
            # Check EmailSubmission result
            for name, result, _ in data.get("methodResponses", []):
                if name == "EmailSubmission/set":
                    created = result.get("created", {})
                    if "sub1" in created:
                        return {
                            "service_available": True,
                            "success": True,
                            "message_id": created["sub1"].get("id"),
                        }
                    not_created = result.get("notCreated", {})
                    error = not_created.get("sub1", {}).get("description", "Unknown error")
                    logger.warning("Stalwart send failed: %s", error)
                    return {"service_available": True, "success": False, "message_id": None}
            return {"service_available": True, "success": False, "message_id": None}
    except Exception as exc:
        logger.warning("Stalwart send_message failed: %s", exc)
        return {"service_available": False, "success": False, "message_id": None}


# ── CalDAV Integration ────────────────────────────────────────────────────────

_CALDAV_BASE = f"{settings.STALWART_URL}/dav/calendars/user"


def _caldav_headers() -> dict[str, str]:
    """Headers for CalDAV requests to Stalwart."""
    return {
        "Authorization": f"Bearer {settings.SECRET_KEY}",
    }


def _format_ical_dt(iso_dt: str) -> str:
    """Convert an ISO 8601 datetime string to iCalendar YYYYMMDDTHHMMSSZ format.

    Handles common ISO formats: ``2024-03-15T10:30:00Z``,
    ``2024-03-15T10:30:00+00:00``, ``2024-03-15T10:30:00``.
    """
    cleaned = iso_dt.replace("-", "").replace(":", "")
    # Remove timezone offset like +0000 or +00:00 (already cleaned colons)
    if "+" in cleaned and cleaned.index("+") > 8:
        cleaned = cleaned[: cleaned.index("+")]
    elif cleaned.endswith("Z"):
        cleaned = cleaned[:-1]
    # Ensure the format is exactly YYYYMMDDTHHMMSS
    if "T" in cleaned:
        date_part, time_part = cleaned.split("T", 1)
        time_part = time_part[:6].ljust(6, "0")
        return f"{date_part}T{time_part}Z"
    return f"{cleaned}T000000Z"


def _build_vcalendar(
    event_id: str,
    title: str,
    start_time: str,
    end_time: str,
    description: str = "",
    location: str = "",
    attendees: list[str] | None = None,
) -> str:
    """Build a minimal VCALENDAR string for the given event."""
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Urban ERP//EN",
        "BEGIN:VEVENT",
        f"UID:{event_id}@urban-erp",
        f"DTSTART:{_format_ical_dt(start_time)}",
        f"DTEND:{_format_ical_dt(end_time)}",
        f"SUMMARY:{title}",
    ]
    if description:
        lines.append(f"DESCRIPTION:{description}")
    if location:
        lines.append(f"LOCATION:{location}")
    if attendees:
        for attendee in attendees:
            lines.append(f"ATTENDEE:mailto:{attendee}")
    lines.extend([
        "END:VEVENT",
        "END:VCALENDAR",
    ])
    return "\r\n".join(lines)


def _parse_vcalendar(ical_text: str) -> dict[str, str]:
    """Parse a VCALENDAR string and extract basic VEVENT fields.

    Returns a dict with keys: uid, title, start, end, description, location.
    Uses simple line-based parsing -- no external library needed.
    """
    result: dict[str, str] = {}
    in_vevent = False
    for line in ical_text.splitlines():
        line = line.strip()
        if line == "BEGIN:VEVENT":
            in_vevent = True
            continue
        if line == "END:VEVENT":
            break
        if not in_vevent:
            continue
        if line.startswith("UID:"):
            result["uid"] = line[4:]
        elif line.startswith("SUMMARY:"):
            result["title"] = line[8:]
        elif line.startswith("DTSTART"):
            # Handle DTSTART;TZID=...:value or DTSTART:value
            value = line.split(":", 1)[-1]
            result["start"] = value
        elif line.startswith("DTEND"):
            value = line.split(":", 1)[-1]
            result["end"] = value
        elif line.startswith("DESCRIPTION:"):
            result["description"] = line[12:]
        elif line.startswith("LOCATION:"):
            result["location"] = line[9:]
    return result


async def caldav_push_event(
    user_email: str,
    event_id: str,
    title: str,
    start_time: str,
    end_time: str,
    description: str = "",
    location: str = "",
    attendees: list[str] | None = None,
) -> dict[str, Any]:
    """Push a calendar event to Stalwart CalDAV server.

    Creates/updates a VCALENDAR object on the user's default calendar.
    Uses HTTP PUT to the CalDAV endpoint since Stalwart supports WebDAV/CalDAV.
    Falls back to returning success=False if Stalwart is unavailable.
    """
    if not _is_configured():
        return {"success": False, "error": "Stalwart not configured"}

    try:
        vcal = _build_vcalendar(
            event_id=event_id,
            title=title,
            start_time=start_time,
            end_time=end_time,
            description=description,
            location=location,
            attendees=attendees,
        )
        url = f"{_CALDAV_BASE}/{user_email}/default/{event_id}.ics"
        headers = _caldav_headers()
        headers["Content-Type"] = "text/calendar"

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.put(url, content=vcal, headers=headers)
            if 200 <= resp.status_code < 300:
                return {"success": True, "uid": event_id}
            logger.warning(
                "Stalwart caldav_push_event HTTP %s: %s", resp.status_code, resp.text
            )
            return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text}"}
    except Exception as exc:
        logger.warning("Stalwart caldav_push_event failed: %s", exc)
        return {"success": False, "error": str(exc)}


async def caldav_pull_events(
    user_email: str,
    since: str | None = None,
) -> dict[str, Any]:
    """Pull calendar events from Stalwart CalDAV server.

    Uses PROPFIND to list calendar items, then GET each .ics file.
    Returns a list of event dicts.
    """
    if not _is_configured():
        return {"success": False, "events": [], "error": "Stalwart not configured"}

    try:
        url = f"{_CALDAV_BASE}/{user_email}/default/"
        headers = _caldav_headers()
        headers["Depth"] = "1"
        headers["Content-Type"] = "application/xml"

        propfind_body = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<d:propfind xmlns:d="DAV:">'
            "<d:prop><d:getetag/></d:prop>"
            "</d:propfind>"
        )

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.request(
                "PROPFIND", url, content=propfind_body, headers=headers
            )
            if resp.status_code not in (200, 207):
                return {
                    "success": False,
                    "events": [],
                    "error": f"PROPFIND HTTP {resp.status_code}",
                }

            # Parse the multistatus XML to extract hrefs for .ics files
            import xml.etree.ElementTree as ET

            ns = {"d": "DAV:"}
            root = ET.fromstring(resp.text)
            hrefs: list[str] = []
            for response_el in root.findall("d:response", ns):
                href_el = response_el.find("d:href", ns)
                if href_el is not None and href_el.text and href_el.text.endswith(".ics"):
                    hrefs.append(href_el.text)

            events: list[dict[str, str]] = []
            get_headers = _caldav_headers()
            for href in hrefs:
                # href may be absolute path or relative; construct full URL
                if href.startswith("http"):
                    ics_url = href
                else:
                    ics_url = f"{settings.STALWART_URL}{href}"
                ics_resp = await client.get(ics_url, headers=get_headers)
                if ics_resp.status_code == 200:
                    parsed = _parse_vcalendar(ics_resp.text)
                    if parsed:
                        events.append(parsed)

            return {"success": True, "events": events}
    except Exception as exc:
        logger.warning("Stalwart caldav_pull_events failed: %s", exc)
        return {"success": False, "events": [], "error": str(exc)}


async def caldav_delete_event(
    user_email: str,
    event_id: str,
) -> dict[str, Any]:
    """Delete a calendar event from Stalwart CalDAV server."""
    if not _is_configured():
        return {"success": False, "error": "Stalwart not configured"}

    try:
        url = f"{_CALDAV_BASE}/{user_email}/default/{event_id}.ics"
        headers = _caldav_headers()

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.delete(url, headers=headers)
            if 200 <= resp.status_code < 300:
                return {"success": True}
            logger.warning(
                "Stalwart caldav_delete_event HTTP %s: %s", resp.status_code, resp.text
            )
            return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text}"}
    except Exception as exc:
        logger.warning("Stalwart caldav_delete_event failed: %s", exc)
        return {"success": False, "error": str(exc)}


# ── CardDAV Integration ──────────────────────────────────────────────────────

_CARDDAV_BASE = f"{settings.STALWART_URL}/dav/addressbooks/user"


def _build_vcard(
    contact_id: str,
    first_name: str,
    last_name: str,
    email: str = "",
    phone: str = "",
) -> str:
    """Build a vCard 3.0 string for a CRM contact."""
    lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        f"UID:{contact_id}@urban-erp",
        f"N:{last_name};{first_name};;;",
        f"FN:{first_name} {last_name}".strip(),
        f"PRODID:-//Urban ERP//EN",
    ]
    if email:
        lines.append(f"EMAIL;TYPE=INTERNET:{email}")
    if phone:
        lines.append(f"TEL;TYPE=CELL:{phone}")
    lines.append("END:VCARD")
    return "\r\n".join(lines)


def _parse_vcard(vcard_text: str) -> dict[str, str]:
    """Parse a vCard 3.0 string and extract basic fields.

    Returns a dict with keys: uid, first_name, last_name, email, phone, full_name.
    """
    result: dict[str, str] = {}
    for line in vcard_text.splitlines():
        line = line.strip()
        if line.startswith("UID:"):
            result["uid"] = line[4:]
        elif line.startswith("FN:"):
            result["full_name"] = line[3:]
        elif line.startswith("N:"):
            # N:Last;First;;;
            parts = line[2:].split(";")
            result["last_name"] = parts[0] if len(parts) > 0 else ""
            result["first_name"] = parts[1] if len(parts) > 1 else ""
        elif "EMAIL" in line and ":" in line:
            result["email"] = line.split(":", 1)[-1]
        elif "TEL" in line and ":" in line:
            result["phone"] = line.split(":", 1)[-1]
    return result


async def carddav_push_contact(
    user_email: str,
    contact_id: str,
    first_name: str,
    last_name: str,
    email: str = "",
    phone: str = "",
) -> dict[str, Any]:
    """Push a CRM contact to Stalwart CardDAV server as a vCard.

    Creates/updates a vCard object on the user's default address book.
    """
    if not _is_configured():
        return {"success": False, "error": "Stalwart not configured"}

    try:
        vcard = _build_vcard(
            contact_id=contact_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
        )
        url = f"{_CARDDAV_BASE}/{user_email}/default/{contact_id}.vcf"
        headers = _caldav_headers()
        headers["Content-Type"] = "text/vcard"

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.put(url, content=vcard, headers=headers)
            if 200 <= resp.status_code < 300:
                return {"success": True, "uid": contact_id}
            logger.warning(
                "Stalwart carddav_push_contact HTTP %s: %s", resp.status_code, resp.text
            )
            return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text}"}
    except Exception as exc:
        logger.warning("Stalwart carddav_push_contact failed: %s", exc)
        return {"success": False, "error": str(exc)}


async def carddav_pull_contacts(
    user_email: str,
) -> dict[str, Any]:
    """Pull contacts from Stalwart CardDAV server.

    Uses PROPFIND to list address book items, then GETs each .vcf file.
    Returns a list of contact dicts.
    """
    if not _is_configured():
        return {"success": False, "contacts": [], "error": "Stalwart not configured"}

    try:
        url = f"{_CARDDAV_BASE}/{user_email}/default/"
        headers = _caldav_headers()
        headers["Depth"] = "1"
        headers["Content-Type"] = "application/xml"

        propfind_body = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<d:propfind xmlns:d="DAV:">'
            "<d:prop><d:getetag/></d:prop>"
            "</d:propfind>"
        )

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.request(
                "PROPFIND", url, content=propfind_body, headers=headers
            )
            if resp.status_code not in (200, 207):
                return {
                    "success": False,
                    "contacts": [],
                    "error": f"PROPFIND HTTP {resp.status_code}",
                }

            import xml.etree.ElementTree as ET

            ns = {"d": "DAV:"}
            root = ET.fromstring(resp.text)
            hrefs: list[str] = []
            for response_el in root.findall("d:response", ns):
                href_el = response_el.find("d:href", ns)
                if href_el is not None and href_el.text and href_el.text.endswith(".vcf"):
                    hrefs.append(href_el.text)

            contacts: list[dict[str, str]] = []
            get_headers = _caldav_headers()
            for href in hrefs:
                if href.startswith("http"):
                    vcf_url = href
                else:
                    vcf_url = f"{settings.STALWART_URL}{href}"
                vcf_resp = await client.get(vcf_url, headers=get_headers)
                if vcf_resp.status_code == 200:
                    parsed = _parse_vcard(vcf_resp.text)
                    if parsed:
                        contacts.append(parsed)

            return {"success": True, "contacts": contacts}
    except Exception as exc:
        logger.warning("Stalwart carddav_pull_contacts failed: %s", exc)
        return {"success": False, "contacts": [], "error": str(exc)}


async def carddav_delete_contact(
    user_email: str,
    contact_id: str,
) -> dict[str, Any]:
    """Delete a vCard from Stalwart CardDAV server."""
    if not _is_configured():
        return {"success": False, "error": "Stalwart not configured"}

    try:
        url = f"{_CARDDAV_BASE}/{user_email}/default/{contact_id}.vcf"
        headers = _caldav_headers()

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.delete(url, headers=headers)
            if 200 <= resp.status_code < 300:
                return {"success": True}
            logger.warning(
                "Stalwart carddav_delete_contact HTTP %s: %s", resp.status_code, resp.text
            )
            return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text}"}
    except Exception as exc:
        logger.warning("Stalwart carddav_delete_contact failed: %s", exc)
        return {"success": False, "error": str(exc)}