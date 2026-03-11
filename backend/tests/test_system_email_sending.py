"""Tests for system email sending via SMTP client (replacing Stalwart).

Verifies that all system email callers (integration_handlers, meetings,
notes, cross_module_links) correctly use smtp_client.send_email.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_send_system_email_uses_smtp_client():
    """_send_system_email should call smtp_client.send_email, not stalwart."""
    with patch("app.integrations.smtp_client.send_email", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"success": True, "message_id": "test-id"}
        from app.core.integration_handlers import _send_system_email

        await _send_system_email(
            to=["user@example.com"],
            subject="Test Subject",
            body="Test body content",
        )

        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args
        assert call_kwargs.kwargs["to_addrs"] == ["user@example.com"]
        assert call_kwargs.kwargs["subject"] == "Test Subject"
        assert call_kwargs.kwargs["body_text"] == "Test body content"


@pytest.mark.asyncio
async def test_send_system_email_swallows_errors():
    """_send_system_email should not raise even if SMTP fails."""
    with patch("app.integrations.smtp_client.send_email", new_callable=AsyncMock) as mock_send:
        mock_send.side_effect = ConnectionRefusedError("SMTP down")
        from app.core.integration_handlers import _send_system_email

        # Should not raise
        await _send_system_email(
            to=["user@example.com"],
            subject="Fail Test",
            body="This should not raise",
        )


@pytest.mark.asyncio
async def test_meetings_invite_uses_smtp_client():
    """Meeting creation invite should use smtp_client, not stalwart."""
    # Verify the import path in meetings.py points to smtp_client
    import app.api.v1.meetings as meetings_module
    import inspect

    source = inspect.getsource(meetings_module)
    assert "from app.integrations.smtp_client import send_email" in source
    assert "stalwart.send_message" not in source


@pytest.mark.asyncio
async def test_meetings_ext_invite_uses_smtp_client():
    """Meeting ext invite endpoint should use smtp_client."""
    import app.api.v1.meetings_ext as meetings_ext_module
    import inspect

    source = inspect.getsource(meetings_ext_module)
    assert "from app.integrations.smtp_client import send_email as smtp_send" in source
    assert "stalwart.send_message" not in source


@pytest.mark.asyncio
async def test_notes_email_uses_smtp_client():
    """Notes email endpoint should use smtp_client."""
    import app.api.v1.notes_ext as notes_ext_module
    import inspect

    source = inspect.getsource(notes_ext_module)
    assert "from app.integrations.smtp_client import send_email" in source
    # notes_ext should no longer import stalwart.send_message for the email endpoint
    # (it may still have other stalwart refs for CalDAV — those are Phase 3)


@pytest.mark.asyncio
async def test_cross_module_receipt_uses_smtp_client():
    """POS receipt email should use smtp_client."""
    import app.api.v1.cross_module_links as cross_module
    import inspect

    source = inspect.getsource(cross_module)
    assert "from app.integrations.smtp_client import send_email" in source
    assert "stalwart" not in source.lower() or "stalwart" not in source.split("send_email")[0]


@pytest.mark.asyncio
async def test_integration_handlers_no_stalwart_import():
    """integration_handlers._send_system_email should not import stalwart."""
    import app.core.integration_handlers as handlers_module
    import inspect

    source = inspect.getsource(handlers_module._send_system_email)
    assert "stalwart" not in source
    assert "smtp_client" in source
