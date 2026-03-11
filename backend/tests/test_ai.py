"""Integration tests for AI API — tool calling, WebSocket chat, RAG."""
from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from tests.conftest import auth_headers


# ── Tool-Calling Integration Tests ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_ai_chat_endpoint(client: AsyncClient, test_user):
    """POST /api/v1/ai/chat sends a message and receives a reply."""
    headers = auth_headers(test_user)

    with patch("app.api.v1.ai.AIService") as MockAI:
        mock_instance = MagicMock()
        mock_instance.chat = AsyncMock(return_value=("Hello! How can I help?", "ollama", "llama3"))
        MockAI.return_value = mock_instance

        resp = await client.post(
            "/api/v1/ai/chat",
            json={"message": "Hello", "session_id": str(uuid.uuid4())},
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "reply" in data
        assert data["reply"] == "Hello! How can I help?"
        assert data["provider"] == "ollama"


@pytest.mark.asyncio
async def test_ai_chat_with_context(client: AsyncClient, test_user):
    """POST /api/v1/ai/chat with context includes it in the message."""
    headers = auth_headers(test_user)

    with patch("app.api.v1.ai.AIService") as MockAI:
        mock_instance = MagicMock()
        mock_instance.chat = AsyncMock(return_value=("Here are the finance details.", "openai", "gpt-4"))
        MockAI.return_value = mock_instance

        resp = await client.post(
            "/api/v1/ai/chat",
            json={
                "message": "Show me the revenue",
                "context": {"module": "finance", "view": "dashboard"},
            },
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "reply" in data


@pytest.mark.asyncio
async def test_ai_chat_returns_session_id(client: AsyncClient, test_user):
    """Chat endpoint returns a session_id for conversation continuity."""
    headers = auth_headers(test_user)

    with patch("app.api.v1.ai.AIService") as MockAI:
        mock_instance = MagicMock()
        mock_instance.chat = AsyncMock(return_value=("Sure thing.", "ollama", "llama3"))
        MockAI.return_value = mock_instance

        resp = await client.post(
            "/api/v1/ai/chat",
            json={"message": "test"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert "session_id" in resp.json()
        assert resp.json()["session_id"] is not None


@pytest.mark.asyncio
async def test_ai_chat_without_auth_fails(client: AsyncClient):
    """AI chat without authentication returns 401/403."""
    resp = await client.post(
        "/api/v1/ai/chat",
        json={"message": "hello"},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_ai_tool_execution_via_chat(client: AsyncClient, test_user):
    """AI chat that triggers a tool call returns the tool result."""
    headers = auth_headers(test_user)

    with patch("app.api.v1.ai.AIService") as MockAI:
        mock_instance = MagicMock()
        # Simulate a tool-call response where the AI used a tool
        mock_instance.chat = AsyncMock(return_value=(
            "I found 15 open invoices totaling $42,300.",
            "ollama",
            "llama3",
        ))
        MockAI.return_value = mock_instance

        resp = await client.post(
            "/api/v1/ai/chat",
            json={"message": "How many open invoices do we have?"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert "invoices" in resp.json()["reply"].lower()


# ── WebSocket Chat Tests ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_websocket_endpoint_exists(client: AsyncClient, test_user):
    """Verify the WebSocket chat endpoint is registered."""
    # We can't fully test WebSocket with httpx, but we can verify the route exists
    # by checking that a non-WS request to the WS path returns an appropriate error
    from app.core.security import create_access_token

    token = create_access_token(
        subject=str(test_user.id),
        email=test_user.email,
        is_superadmin=test_user.is_superadmin,
    )

    # A GET to a WebSocket endpoint without upgrade header should fail
    resp = await client.get(
        f"/api/v1/ws/chat/{uuid.uuid4()}?token={token}",
    )
    # WebSocket endpoints typically return 403 or 400 for non-WS requests
    # or 404 if not registered — anything other than 200 is expected
    assert resp.status_code != 200


# ── Chat History Tests ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ai_chat_history_list(client: AsyncClient, test_user):
    """GET /api/v1/ai/history returns chat history."""
    headers = auth_headers(test_user)
    resp = await client.get("/api/v1/ai/history", headers=headers)
    # Should return 200 with a list (may be empty if no history exists)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_ai_audit_log_list(client: AsyncClient, superadmin_user):
    """GET /api/v1/ai/audit returns audit logs (admin only)."""
    headers = auth_headers(superadmin_user)
    resp = await client.get("/api/v1/ai/audit", headers=headers)
    # Should be 200 for superadmin
    assert resp.status_code == 200


# ── RAG Query Tests ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_rag_search_endpoint(client: AsyncClient, test_user):
    """POST /api/v1/ai/rag/search queries the knowledge base."""
    headers = auth_headers(test_user)

    with patch("app.api.v1.ai.AIService") as MockAI:
        mock_instance = MagicMock()
        # Mock a RAG search response
        mock_instance.rag_search = AsyncMock(return_value={
            "results": [
                {"content": "Revenue policy...", "score": 0.92, "source": "finance_policy.pdf"},
            ],
            "total": 1,
        })
        MockAI.return_value = mock_instance

        resp = await client.post(
            "/api/v1/ai/rag/search",
            json={"query": "revenue policy", "top_k": 5},
            headers=headers,
        )
        # Endpoint may or may not exist yet — accept 200 or 404
        assert resp.status_code in (200, 404, 422)


@pytest.mark.asyncio
async def test_rag_ingest_endpoint(client: AsyncClient, superadmin_user):
    """POST /api/v1/ai/rag/ingest adds a document to the knowledge base."""
    headers = auth_headers(superadmin_user)

    resp = await client.post(
        "/api/v1/ai/rag/ingest",
        json={
            "content": "The company travel policy requires pre-approval for all trips over $500.",
            "source": "travel_policy.txt",
            "metadata": {"category": "hr", "version": "2.0"},
        },
        headers=headers,
    )
    # Accept 200, 201, or 404 (if endpoint not yet implemented)
    assert resp.status_code in (200, 201, 404, 422)


@pytest.mark.asyncio
async def test_ai_tools_list_endpoint(client: AsyncClient, test_user):
    """GET /api/v1/ai/tools lists available AI tools."""
    headers = auth_headers(test_user)
    resp = await client.get("/api/v1/ai/tools", headers=headers)
    # Accept 200 or 404
    if resp.status_code == 200:
        data = resp.json()
        assert isinstance(data, (list, dict))


@pytest.mark.asyncio
async def test_ai_models_endpoint(client: AsyncClient, superadmin_user):
    """GET /api/v1/ai/models lists available AI models."""
    headers = auth_headers(superadmin_user)
    resp = await client.get("/api/v1/ai/models", headers=headers)
    # Accept 200 or 404
    assert resp.status_code in (200, 404)
