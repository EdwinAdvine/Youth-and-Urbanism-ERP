"""Mail parser service — extract ICS calendar events and structured data from emails."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


def parse_ics_from_text(ics_text: str) -> list[dict[str, Any]]:
    """
    Parse iCalendar (ICS) text and return a list of event dicts.

    Each event dict contains: summary, dtstart, dtend, description, location, uid.
    Uses simple regex parsing to avoid external icalendar dependency.
    """
    events: list[dict[str, Any]] = []

    # Split into VEVENT blocks
    vevent_pattern = re.compile(
        r"BEGIN:VEVENT(.*?)END:VEVENT", re.DOTALL
    )

    for match in vevent_pattern.finditer(ics_text):
        block = match.group(1)
        event: dict[str, Any] = {}

        # Extract standard fields
        for field, key in [
            ("SUMMARY", "summary"),
            ("DESCRIPTION", "description"),
            ("LOCATION", "location"),
            ("UID", "uid"),
        ]:
            field_match = re.search(rf"^{field}[;:](.+)$", block, re.MULTILINE)
            if field_match:
                # Handle folded lines and strip parameters
                value = field_match.group(1).strip()
                # Remove value parameters like ;LANGUAGE=en
                if ":" in value and not value.startswith("http"):
                    value = value.split(":", 1)[-1]
                event[key] = value

        # Extract datetime fields
        for field, key in [("DTSTART", "dtstart"), ("DTEND", "dtend")]:
            field_match = re.search(rf"^{field}[;:](.+)$", block, re.MULTILINE)
            if field_match:
                raw = field_match.group(1).strip()
                event[key] = _parse_ical_datetime(raw)

        if event.get("summary"):
            events.append(event)

    logger.info("Parsed %d events from ICS text", len(events))
    return events


def _parse_ical_datetime(raw: str) -> datetime | None:
    """Parse an iCal datetime string into a Python datetime."""
    # Strip parameters like TZID=America/New_York:
    if ":" in raw:
        raw = raw.split(":")[-1]

    raw = raw.strip()

    formats = [
        "%Y%m%dT%H%M%SZ",   # UTC format
        "%Y%m%dT%H%M%S",    # Local time
        "%Y%m%d",            # Date only
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(raw, fmt)
            if fmt.endswith("Z"):
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue

    logger.debug("Could not parse iCal datetime: %s", raw)
    return None


def extract_ics_attachments(email_parts: list[dict[str, Any]]) -> list[str]:
    """
    Extract ICS content from email MIME parts.

    Expects a list of dicts with keys: content_type, filename, content (base64 or text).
    Returns list of raw ICS text strings.
    """
    ics_texts: list[str] = []

    for part in email_parts:
        content_type = (part.get("content_type") or "").lower()
        filename = (part.get("filename") or "").lower()

        if "text/calendar" in content_type or filename.endswith(".ics"):
            content = part.get("content", "")
            if isinstance(content, bytes):
                content = content.decode("utf-8", errors="replace")
            if "BEGIN:VCALENDAR" in content:
                ics_texts.append(content)

    return ics_texts


def email_to_calendar_events(email_parts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    End-to-end: extract ICS from email parts and parse into event dicts.

    Returns a list of event dicts ready for CalendarEvent creation.
    """
    events: list[dict[str, Any]] = []

    for ics_text in extract_ics_attachments(email_parts):
        events.extend(parse_ics_from_text(ics_text))

    return events
