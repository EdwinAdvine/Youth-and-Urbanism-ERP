"""Integration tests for the Search API."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_global_search(client: AsyncClient, test_user):
    """GET /api/v1/search?q=test returns search results."""
    resp = await client.get(
        "/api/v1/search/",
        params={"q": "test"},
        headers=auth_headers(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, (list, dict))


@pytest.mark.asyncio
async def test_search_empty_query(client: AsyncClient, test_user):
    """GET /api/v1/search without q returns 422 or empty."""
    resp = await client.get(
        "/api/v1/search/",
        headers=auth_headers(test_user),
    )
    assert resp.status_code in (200, 422)


@pytest.mark.asyncio
async def test_search_requires_auth(client: AsyncClient):
    """Search endpoint requires authentication."""
    resp = await client.get("/api/v1/search/", params={"q": "test"})
    assert resp.status_code in (401, 403)
