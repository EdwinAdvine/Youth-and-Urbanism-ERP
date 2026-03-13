"""Calendar – Mail Scanner API.

Exposes three endpoints that let the frontend trigger or retrieve Era Mail
scheduling-intent scans and turn accepted suggestions into real calendar events.

Routes
------
POST /calendar/scan-mail/{message_id}
    Scan a single mail message for scheduling intent.

GET /calendar/mail-suggestions
    Return all pending calendar suggestions produced by the batch scan for
    the current user.

POST /calendar/mail-suggestions/{suggestion_id}/accept
    Accept a suggestion and materialise it as a CalendarEvent.
"""


import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus

router = APIRouter(prefix="/calendar", tags=["Calendar - Mail Scanner"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class MailScanResult(BaseModel):
    """Response schema for a single-message scan."""

    message_id: str
    has_scheduling_intent: bool
    confidence: float
    suggested_event: dict[str, Any] | None

    model_config = {"from_attributes": True}


class CalendarSuggestionOut(BaseModel):
    """A pending calendar suggestion stored in the MailboxMessage's ai_triage."""

    suggestion_id: str   # deterministic: "cal-suggest-{message_id}"
    message_id: str
    confidence: float
    suggested_event: dict[str, Any]

    model_config = {"from_attributes": True}


class AcceptSuggestionPayload(BaseModel):
    """Optional overrides the user can apply before accepting a suggestion."""

    title: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    location: str | None = None
    attendees: list[str] | None = None


class AcceptSuggestionResult(BaseModel):
    event_id: str
    title: str
    start_time: datetime | None
    end_time: datetime | None
    message: str = "Calendar event created from mail suggestion"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SUGGESTION_KEY = "calendar_suggestion"  # key inside ai_triage JSONB


async def _get_message_with_suggestion(
    message_id: str,
    user_id: uuid.UUID,
    db: DBSession,
) -> Any:
    """Load a MailboxMessage that belongs to the current user and has a
    pending calendar suggestion stored in ai_triage.

    Raises HTTPException 404 when not found.
    """
    from app.models.mail_storage import MailboxMessage  # local import

    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid message_id: {message_id!r}",
        )

    result = await db.execute(
        select(MailboxMessage).where(
            MailboxMessage.id == msg_uuid,
            MailboxMessage.user_id == user_id,
        )
    )
    message = result.scalar_one_or_none()

    if message is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mail message not found or does not belong to current user.",
        )

    triage: dict = message.ai_triage or {}
    if _SUGGESTION_KEY not in triage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No calendar suggestion found for this message. "
                   "Run POST /calendar/scan-mail/{message_id} first.",
        )

    return message


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/scan-mail/{message_id}",
    response_model=MailScanResult,
    summary="Scan a mail message for scheduling intent",
    description=(
        "Sends the email's subject and body to the local Ollama model and "
        "extracts any meeting/scheduling information. The result is stored "
        "back into the message's ai_triage field so it can be retrieved later "
        "via GET /calendar/mail-suggestions."
    ),
)
async def scan_single_mail(
    message_id: str,
    db: DBSession,
    current_user: CurrentUser,
) -> MailScanResult:
    from app.models.mail_storage import MailboxMessage  # local import
    from app.services.mail_calendar_scanner import scan_mail_for_scheduling_intent

    # Verify the message belongs to the requesting user before scanning
    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid message_id: {message_id!r}",
        )

    ownership_check = await db.execute(
        select(MailboxMessage.id).where(
            MailboxMessage.id == msg_uuid,
            MailboxMessage.user_id == current_user.id,
        )
    )
    if ownership_check.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mail message not found.",
        )

    scan_result = await scan_mail_for_scheduling_intent(message_id, db)

    # Persist suggestion into ai_triage so the GET endpoint can surface it
    if scan_result.get("has_scheduling_intent") and scan_result.get("suggested_event"):
        result = await db.execute(
            select(MailboxMessage).where(MailboxMessage.id == msg_uuid)
        )
        message = result.scalar_one_or_none()
        if message:
            triage = dict(message.ai_triage or {})
            triage[_SUGGESTION_KEY] = {
                "confidence": scan_result["confidence"],
                "suggested_event": scan_result["suggested_event"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            message.ai_triage = triage
            try:
                await db.commit()
            except Exception:
                await db.rollback()

    return MailScanResult(
        message_id=message_id,
        has_scheduling_intent=scan_result.get("has_scheduling_intent", False),
        confidence=scan_result.get("confidence", 0.0),
        suggested_event=scan_result.get("suggested_event"),
    )


@router.get(
    "/mail-suggestions",
    response_model=list[CalendarSuggestionOut],
    summary="List pending calendar suggestions from mail",
    description=(
        "Returns all mail messages for the current user that have a pending "
        "calendar suggestion (produced by the scanner). "
        "Optionally trigger a fresh batch scan with ?scan=true."
    ),
)
async def list_mail_suggestions(
    db: DBSession,
    current_user: CurrentUser,
    scan: bool = Query(
        default=False,
        description="Trigger a fresh 24-hour batch scan before returning results.",
    ),
    hours: int = Query(
        default=24,
        ge=1,
        le=168,
        description="Used only when scan=true. How many hours back to scan.",
    ),
) -> list[CalendarSuggestionOut]:
    from app.models.mail_storage import MailboxMessage  # local import

    if scan:
        from app.services.mail_calendar_scanner import batch_scan_recent_mail

        new_suggestions = await batch_scan_recent_mail(
            user_id=str(current_user.id),
            db=db,
            hours=hours,
        )
        # Persist each new suggestion into its message's ai_triage
        for item in new_suggestions:
            msg_id_str: str = item.get("message_id", "")
            if not msg_id_str:
                continue
            try:
                msg_uuid = uuid.UUID(msg_id_str)
            except ValueError:
                continue
            result = await db.execute(
                select(MailboxMessage).where(MailboxMessage.id == msg_uuid)
            )
            message = result.scalar_one_or_none()
            if message and item.get("suggested_event"):
                triage = dict(message.ai_triage or {})
                triage[_SUGGESTION_KEY] = {
                    "confidence": item["confidence"],
                    "suggested_event": item["suggested_event"],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                message.ai_triage = triage
        try:
            await db.commit()
        except Exception:
            await db.rollback()

    # Fetch all messages for this user that have a calendar_suggestion
    from sqlalchemy.dialects.postgresql import JSONB

    stmt = select(MailboxMessage).where(
        MailboxMessage.user_id == current_user.id,
        MailboxMessage.is_deleted.is_(False),
        # ai_triage JSONB must contain the calendar_suggestion key
        MailboxMessage.ai_triage[_SUGGESTION_KEY].as_string().isnot(None),
    )

    result = await db.execute(stmt)
    messages = result.scalars().all()

    suggestions: list[CalendarSuggestionOut] = []
    for msg in messages:
        triage: dict = msg.ai_triage or {}
        suggestion_data: dict = triage.get(_SUGGESTION_KEY, {})
        if not suggestion_data:
            continue

        suggestions.append(
            CalendarSuggestionOut(
                suggestion_id=f"cal-suggest-{msg.id}",
                message_id=str(msg.id),
                confidence=float(suggestion_data.get("confidence", 0.0)),
                suggested_event=suggestion_data.get("suggested_event", {}),
            )
        )

    return suggestions


@router.post(
    "/mail-suggestions/{suggestion_id}/accept",
    response_model=AcceptSuggestionResult,
    status_code=status.HTTP_201_CREATED,
    summary="Accept a mail-derived calendar suggestion",
    description=(
        "Creates a real CalendarEvent from the pending suggestion. "
        "Optional overrides (title, start_time, end_time, location, attendees) "
        "can be supplied in the request body. The suggestion is cleared from "
        "the message's ai_triage after acceptance."
    ),
)
async def accept_mail_suggestion(
    suggestion_id: str,
    db: DBSession,
    current_user: CurrentUser,
    payload: AcceptSuggestionPayload | None = None,
) -> AcceptSuggestionResult:
    from app.models.calendar import CalendarEvent  # local import
    from app.models.mail_storage import MailboxMessage  # local import

    # suggestion_id format: "cal-suggest-{message_uuid}"
    prefix = "cal-suggest-"
    if not suggestion_id.startswith(prefix):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid suggestion_id format: {suggestion_id!r}. "
                   "Expected 'cal-suggest-<message_uuid>'.",
        )

    message_id_str = suggestion_id[len(prefix):]
    message = await _get_message_with_suggestion(
        message_id=message_id_str,
        user_id=current_user.id,
        db=db,
    )

    triage: dict = message.ai_triage or {}
    suggestion_data: dict = triage.get(_SUGGESTION_KEY, {})
    suggested_event: dict = suggestion_data.get("suggested_event", {})

    overrides = payload or AcceptSuggestionPayload()

    # Resolve title
    title: str = overrides.title or suggested_event.get("title") or message.subject or "Meeting"

    # Resolve start / end times
    def _parse_iso(val: Any) -> datetime | None:
        if val is None:
            return None
        if isinstance(val, datetime):
            return val
        try:
            dt = datetime.fromisoformat(str(val))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            return None

    start_time: datetime | None = overrides.start_time or _parse_iso(
        suggested_event.get("start_time")
    )
    end_time: datetime | None = overrides.end_time or _parse_iso(
        suggested_event.get("end_time")
    )

    # Fallback: if no times extracted, set event 1 hour from now
    if start_time is None:
        from datetime import timedelta
        start_time = datetime.now(timezone.utc).replace(second=0, microsecond=0) + timedelta(hours=1)
    if end_time is None:
        from datetime import timedelta
        end_time = start_time + timedelta(hours=1)

    # Resolve location and attendees
    location: str | None = overrides.location or suggested_event.get("location")
    attendees: list[str] = (
        overrides.attendees
        if overrides.attendees is not None
        else (suggested_event.get("attendees") or [])
    )

    # Build erp_context carrying mail provenance
    erp_context: dict = {
        **(suggested_event.get("erp_context") or {}),
        "created_from": "mail_calendar_suggestion",
        "accepted_by": str(current_user.id),
        "accepted_at": datetime.now(timezone.utc).isoformat(),
    }

    # Create the CalendarEvent
    event = CalendarEvent(
        title=title,
        start_time=start_time,
        end_time=end_time,
        event_type="meeting",
        organizer_id=current_user.id,
        attendees=attendees,
        location=location,
        erp_context=erp_context,
        color="#51459d",
    )
    db.add(event)

    # Clear the suggestion from ai_triage so it doesn't resurface
    triage.pop(_SUGGESTION_KEY, None)
    message.ai_triage = triage

    try:
        await db.commit()
        await db.refresh(event)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create calendar event: {exc}",
        ) from exc

    # Publish event so other modules (notifications, etc.) react
    await event_bus.publish(
        "calendar.event.created",
        {
            "event_id": str(event.id),
            "title": event.title,
            "organizer_id": str(current_user.id),
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "source": "mail_calendar_scanner",
        },
    )

    return AcceptSuggestionResult(
        event_id=str(event.id),
        title=event.title,
        start_time=event.start_time,
        end_time=event.end_time,
    )
