"""Mail API — proxies requests to the Stalwart mail server via JMAP.

Enhanced with: inbox rules, signatures, read receipts, AI reply suggestions.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession
from app.core.events import event_bus
from app.models.mail import MailRule, MailSignature, ReadReceipt

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class SendMessagePayload(BaseModel):
    to: list[EmailStr]
    subject: str
    body: str
    cc: list[EmailStr] | None = None
    html_body: str | None = None
    in_reply_to: str | None = None
    references: str | None = None
    signature_id: str | None = None
    request_read_receipt: bool = False


class RuleCreate(BaseModel):
    name: str
    conditions: dict
    actions: list
    match_mode: str = "all"
    priority: int = 0
    is_active: bool = True
    stop_processing: bool = False


class RuleUpdate(BaseModel):
    name: str | None = None
    conditions: dict | None = None
    actions: list | None = None
    match_mode: str | None = None
    priority: int | None = None
    is_active: bool | None = None
    stop_processing: bool | None = None


class SignatureCreate(BaseModel):
    name: str
    content_text: str = ""
    content_html: str = ""
    is_default: bool = False


class SignatureUpdate(BaseModel):
    name: str | None = None
    content_text: str | None = None
    content_html: str | None = None
    is_default: bool | None = None


class ReplyPayload(BaseModel):
    message_id: str
    body: str
    html_body: str | None = None
    reply_all: bool = False


class ForwardPayload(BaseModel):
    message_id: str
    to: list[EmailStr]
    body: str | None = None


class AISuggestPayload(BaseModel):
    message_id: str
    context: str | None = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _user_email(current_user: Any) -> str:
    """Derive the mailbox address for the current user."""
    email = getattr(current_user, "email", None)
    if email:
        return email
    username = getattr(current_user, "username", str(current_user.id))
    return f"{username}@{settings.MAIL_DOMAIN}"


async def _append_signature(
    db: AsyncSession, user_id: uuid.UUID, body: str, html_body: str | None, signature_id: str | None,
) -> tuple[str, str | None]:
    """Append the selected (or default) signature to message body."""
    if signature_id:
        sig = await db.get(MailSignature, uuid.UUID(signature_id))
    else:
        result = await db.execute(
            select(MailSignature).where(
                MailSignature.owner_id == user_id, MailSignature.is_default.is_(True)
            ).limit(1)
        )
        sig = result.scalar_one_or_none()

    if not sig:
        return body, html_body

    body = f"{body}\n\n--\n{sig.content_text}" if sig.content_text else body
    if html_body and sig.content_html:
        html_body = f"{html_body}<br><br><div class='signature'>{sig.content_html}</div>"
    return body, html_body


# ── Core mail endpoints ──────────────────────────────────────────────────────

@router.get("/folders", summary="List mail folders (Stalwart JMAP)")
async def list_folders(current_user: CurrentUser) -> dict[str, Any]:
    from app.integrations import stalwart  # noqa: PLC0415

    result = await stalwart.list_folders(_user_email(current_user))
    return result


@router.get("/messages", summary="List messages in a folder")
async def list_messages(
    current_user: CurrentUser,
    folder: str = Query("inbox", description="Folder ID or name"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    from app.integrations import stalwart  # noqa: PLC0415

    result = await stalwart.list_messages(
        user_email=_user_email(current_user),
        folder_id=folder,
        page=page,
        limit=limit,
    )
    return result


@router.get("/message/{message_id}", summary="Get full message content")
async def get_message(
    message_id: str,
    current_user: CurrentUser,
) -> dict[str, Any]:
    from app.integrations import stalwart  # noqa: PLC0415

    result = await stalwart.get_message(_user_email(current_user), message_id)
    if result.get("service_available") and result.get("message") is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return result


@router.post("/send", status_code=status.HTTP_201_CREATED, summary="Send an email")
async def send_email(
    payload: SendMessagePayload,
    current_user: CurrentUser,
    db: DBSession,
) -> dict[str, Any]:
    from app.integrations import stalwart  # noqa: PLC0415

    from_email = _user_email(current_user)

    # Append signature
    body, html_body = await _append_signature(
        db, current_user.id, payload.body, payload.html_body, payload.signature_id
    )

    result = await stalwart.send_message(
        from_email=from_email,
        to=[str(addr) for addr in payload.to],
        subject=payload.subject,
        body=body,
        cc=[str(addr) for addr in payload.cc] if payload.cc else None,
        html_body=html_body,
    )

    if not result.get("service_available"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mail service is not available",
        )
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send email via mail server",
        )

    # Create read receipt tracking if requested
    if payload.request_read_receipt:
        msg_id = result.get("message_id", f"sent-{uuid.uuid4().hex[:12]}")
        for addr in payload.to:
            receipt = ReadReceipt(
                message_id=msg_id,
                sender_id=current_user.id,
                recipient_email=str(addr),
            )
            db.add(receipt)
        await db.commit()

    # Publish event for Mail→Calendar integration
    await event_bus.publish("mail.sent", {
        "user_id": str(current_user.id),
        "from": from_email,
        "to": [str(a) for a in payload.to],
        "subject": payload.subject,
        "message_id": result.get("message_id"),
    })

    return result


@router.put("/message/{message_id}/read", summary="Mark a message as read")
async def mark_as_read(
    message_id: str,
    current_user: CurrentUser,
) -> dict[str, Any]:
    """Mark a message as read via Stalwart JMAP Email/set (keywords update)."""
    import httpx  # noqa: PLC0415

    user_email = _user_email(current_user)

    stalwart_url = settings.STALWART_URL.strip()
    if not stalwart_url or stalwart_url in ("", "http://stalwart:8080"):
        return {"service_available": False, "success": False}

    jmap_base = f"{stalwart_url}/jmap"
    headers = {
        "Authorization": f"Bearer {settings.SECRET_KEY}",
        "X-User-Email": user_email,
        "Content-Type": "application/json",
    }
    payload_data = {
        "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
        "methodCalls": [
            [
                "Email/set",
                {
                    "accountId": user_email,
                    "update": {
                        message_id: {
                            "keywords/\\Seen": True,
                        }
                    },
                },
                "0",
            ]
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(jmap_base, json=payload_data, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            for name, result, _ in data.get("methodResponses", []):
                if name == "Email/set":
                    updated = result.get("updated", {})
                    return {
                        "service_available": True,
                        "success": message_id in updated,
                        "message_id": message_id,
                    }
            return {"service_available": True, "success": False, "action": "mark_read"}
    except Exception as exc:
        return {"service_available": False, "success": False, "error": str(exc), "action": "mark_read"}


@router.delete("/message/{message_id}", status_code=status.HTTP_200_OK, summary="Delete/trash a message")
async def delete_message(
    message_id: str,
    current_user: CurrentUser,
) -> dict[str, Any]:
    """Move a message to Trash via Stalwart JMAP Email/set."""
    import httpx  # noqa: PLC0415

    user_email = _user_email(current_user)

    stalwart_url = settings.STALWART_URL.strip()
    if not stalwart_url or stalwart_url in ("", "http://stalwart:8080"):
        return {"service_available": False, "success": False}

    jmap_base = f"{stalwart_url}/jmap"
    headers = {
        "Authorization": f"Bearer {settings.SECRET_KEY}",
        "X-User-Email": user_email,
        "Content-Type": "application/json",
    }

    payload_data = {
        "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
        "methodCalls": [
            [
                "Mailbox/query",
                {"accountId": user_email, "filter": {"role": "trash"}},
                "0",
            ],
            [
                "Email/set",
                {
                    "accountId": user_email,
                    "update": {
                        message_id: {
                            "#mailboxIds": {
                                "resultOf": "0",
                                "name": "Mailbox/query",
                                "path": "/ids/0",
                            }
                        }
                    },
                },
                "1",
            ],
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(jmap_base, json=payload_data, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            for name, result, _ in data.get("methodResponses", []):
                if name == "Email/set":
                    updated = result.get("updated", {})
                    return {
                        "service_available": True,
                        "success": message_id in updated,
                        "message_id": message_id,
                    }
            return {"service_available": True, "success": False}
    except Exception as exc:
        return {"service_available": False, "success": False, "error": str(exc)}


# ── Reply / Forward ──────────────────────────────────────────────────────────

@router.post("/reply", status_code=status.HTTP_201_CREATED, summary="Reply to an email")
async def reply_to_email(
    payload: ReplyPayload,
    current_user: CurrentUser,
) -> dict[str, Any]:
    from app.integrations import stalwart  # noqa: PLC0415

    user_email = _user_email(current_user)
    original = await stalwart.get_message(user_email, payload.message_id)

    if not original.get("service_available"):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Mail service unavailable")

    msg = original.get("message")
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original message not found")

    to_addrs = [msg.get("from", user_email)] if not payload.reply_all else [msg.get("from", "")] + (msg.get("cc") or [])
    to_addrs = [a for a in to_addrs if a and a != user_email]
    if not to_addrs:
        to_addrs = [msg.get("from", "")]

    subject = msg.get("subject", "")
    if not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"

    result = await stalwart.send_message(
        from_email=user_email, to=to_addrs, subject=subject,
        body=payload.body, html_body=payload.html_body,
    )
    if not result.get("success", False):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to send reply")
    return result


@router.post("/forward", status_code=status.HTTP_201_CREATED, summary="Forward an email")
async def forward_email(
    payload: ForwardPayload,
    current_user: CurrentUser,
) -> dict[str, Any]:
    from app.integrations import stalwart  # noqa: PLC0415

    user_email = _user_email(current_user)
    original = await stalwart.get_message(user_email, payload.message_id)

    if not original.get("service_available"):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Mail service unavailable")

    msg = original.get("message")
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original message not found")

    subject = msg.get("subject", "")
    if not subject.lower().startswith("fwd:"):
        subject = f"Fwd: {subject}"

    original_body = msg.get("body_text", "") or msg.get("body_html", "")
    combined = f"{payload.body or ''}\n\n---------- Forwarded message ----------\nFrom: {msg.get('from', '')}\nSubject: {msg.get('subject', '')}\n\n{original_body}"

    result = await stalwart.send_message(
        from_email=user_email, to=[str(a) for a in payload.to],
        subject=subject, body=combined,
    )
    if not result.get("success", False):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to forward email")
    return result


# ── Inbox Rules ──────────────────────────────────────────────────────────────

@router.get("/rules", summary="List inbox rules")
async def list_rules(current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    result = await db.execute(
        select(MailRule).where(MailRule.owner_id == current_user.id).order_by(MailRule.priority)
    )
    rules = result.scalars().all()
    return {
        "total": len(rules),
        "rules": [
            {
                "id": str(r.id), "name": r.name, "is_active": r.is_active,
                "priority": r.priority, "conditions": r.conditions, "actions": r.actions,
                "match_mode": r.match_mode, "stop_processing": r.stop_processing,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rules
        ],
    }


@router.post("/rules", status_code=status.HTTP_201_CREATED, summary="Create inbox rule")
async def create_rule(payload: RuleCreate, current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    rule = MailRule(
        owner_id=current_user.id,
        name=payload.name,
        conditions=payload.conditions,
        actions=payload.actions,
        match_mode=payload.match_mode,
        priority=payload.priority,
        is_active=payload.is_active,
        stop_processing=payload.stop_processing,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {
        "id": str(rule.id), "name": rule.name, "is_active": rule.is_active,
        "priority": rule.priority, "conditions": rule.conditions, "actions": rule.actions,
        "match_mode": rule.match_mode, "stop_processing": rule.stop_processing,
    }


@router.put("/rules/{rule_id}", summary="Update inbox rule")
async def update_rule(
    rule_id: str, payload: RuleUpdate, current_user: CurrentUser, db: DBSession,
) -> dict[str, Any]:
    rule = await db.get(MailRule, uuid.UUID(rule_id))
    if not rule or rule.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Rule not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)
    return {"id": str(rule.id), "name": rule.name, "updated": True}


@router.delete("/rules/{rule_id}", summary="Delete inbox rule")
async def delete_rule(rule_id: str, current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    rule = await db.get(MailRule, uuid.UUID(rule_id))
    if not rule or rule.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(rule)
    await db.commit()
    return {"deleted": True}


# ── Signatures ───────────────────────────────────────────────────────────────

@router.get("/signatures", summary="List email signatures")
async def list_signatures(current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    result = await db.execute(
        select(MailSignature).where(MailSignature.owner_id == current_user.id)
    )
    sigs = result.scalars().all()
    return {
        "total": len(sigs),
        "signatures": [
            {
                "id": str(s.id), "name": s.name,
                "content_text": s.content_text, "content_html": s.content_html,
                "is_default": s.is_default,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sigs
        ],
    }


@router.post("/signatures", status_code=status.HTTP_201_CREATED, summary="Create email signature")
async def create_signature(payload: SignatureCreate, current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    # If setting as default, unset any existing default
    if payload.is_default:
        await db.execute(
            update(MailSignature)
            .where(MailSignature.owner_id == current_user.id, MailSignature.is_default.is_(True))
            .values(is_default=False)
        )

    sig = MailSignature(
        owner_id=current_user.id,
        name=payload.name,
        content_text=payload.content_text,
        content_html=payload.content_html,
        is_default=payload.is_default,
    )
    db.add(sig)
    await db.commit()
    await db.refresh(sig)
    return {
        "id": str(sig.id), "name": sig.name,
        "content_text": sig.content_text, "content_html": sig.content_html,
        "is_default": sig.is_default,
    }


@router.put("/signatures/{sig_id}", summary="Update email signature")
async def update_signature(
    sig_id: str, payload: SignatureUpdate, current_user: CurrentUser, db: DBSession,
) -> dict[str, Any]:
    sig = await db.get(MailSignature, uuid.UUID(sig_id))
    if not sig or sig.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Signature not found")

    update_data = payload.model_dump(exclude_unset=True)

    # Handle default toggle
    if update_data.get("is_default"):
        await db.execute(
            update(MailSignature)
            .where(MailSignature.owner_id == current_user.id, MailSignature.id != sig.id)
            .values(is_default=False)
        )

    for field, value in update_data.items():
        setattr(sig, field, value)

    await db.commit()
    await db.refresh(sig)
    return {"id": str(sig.id), "name": sig.name, "updated": True}


@router.delete("/signatures/{sig_id}", summary="Delete email signature")
async def delete_signature(sig_id: str, current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    sig = await db.get(MailSignature, uuid.UUID(sig_id))
    if not sig or sig.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Signature not found")
    await db.delete(sig)
    await db.commit()
    return {"deleted": True}


# ── Read Receipts ────────────────────────────────────────────────────────────

@router.get("/read-receipts", summary="List read receipt status for sent messages")
async def list_read_receipts(current_user: CurrentUser, db: DBSession) -> dict[str, Any]:
    result = await db.execute(
        select(ReadReceipt).where(ReadReceipt.sender_id == current_user.id).order_by(ReadReceipt.requested_at.desc())
    )
    receipts = result.scalars().all()
    return {
        "total": len(receipts),
        "receipts": [
            {
                "id": str(r.id), "message_id": r.message_id,
                "recipient_email": r.recipient_email,
                "requested_at": r.requested_at.isoformat() if r.requested_at else None,
                "read_at": r.read_at.isoformat() if r.read_at else None,
            }
            for r in receipts
        ],
    }


@router.post("/read-receipts/{receipt_id}/confirm", summary="Confirm a read receipt")
async def confirm_read_receipt(receipt_id: str, db: DBSession) -> dict[str, Any]:
    """Called when a recipient opens a tracked message (e.g., via tracking pixel)."""
    from datetime import datetime, timezone

    receipt = await db.get(ReadReceipt, uuid.UUID(receipt_id))
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if receipt.read_at:
        return {"already_confirmed": True}

    receipt.read_at = datetime.now(timezone.utc)
    await db.commit()
    return {"confirmed": True, "read_at": receipt.read_at.isoformat()}


# ── AI Reply Suggestions ────────────────────────────────────────────────────

@router.post("/ai-suggest-reply", summary="Get AI-generated reply suggestions")
async def ai_suggest_reply(
    payload: AISuggestPayload,
    current_user: CurrentUser,
) -> dict[str, Any]:
    from app.integrations import stalwart  # noqa: PLC0415
    from app.services.ai import AIService  # noqa: PLC0415

    user_email = _user_email(current_user)
    original = await stalwart.get_message(user_email, payload.message_id)

    if not original.get("service_available"):
        return {"suggestions": [], "error": "Mail service unavailable"}

    msg = original.get("message")
    if not msg:
        return {"suggestions": [], "error": "Message not found"}

    email_context = (
        f"From: {msg.get('from', '')}\n"
        f"Subject: {msg.get('subject', '')}\n"
        f"Body:\n{msg.get('body_text', '') or msg.get('body_html', '')}"
    )

    prompt = (
        "You are an email assistant. Based on the email below, generate exactly 3 different reply suggestions. "
        "Each should be a complete, professional reply. Return them as a JSON array of 3 strings.\n\n"
        f"Email:\n{email_context}"
    )
    if payload.context:
        prompt += f"\n\nAdditional context: {payload.context}"

    try:
        ai = AIService()
        response = await ai.generate(
            prompt=prompt,
            user_id=str(current_user.id),
            context={"tool": "mail_suggest_reply"},
        )
        # Try to parse as JSON array
        import json
        text = response.get("response", "")
        # Extract JSON array from response
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            suggestions = json.loads(text[start:end])
        else:
            suggestions = [text]

        return {"suggestions": suggestions[:3]}
    except Exception as exc:
        return {"suggestions": [], "error": str(exc)}
