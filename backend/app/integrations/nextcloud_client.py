"""Nextcloud integration client for Y&U Drive advanced sharing.

Communicates with the Nextcloud instance running in our Docker stack
via its OCS/WebDAV APIs on the internal network. All calls go through
our FastAPI orchestrator — never exposed directly to clients.

Long-term (Phase 3): This wrapper gets replaced once we rewrite sharing
logic into pure FastAPI + MinIO. The Nextcloud container can then be removed.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

NEXTCLOUD_BASE_URL = getattr(settings, "NEXTCLOUD_URL", "http://nextcloud-web:80")
NEXTCLOUD_ADMIN_USER = getattr(settings, "NEXTCLOUD_ADMIN_USER", "admin")
NEXTCLOUD_ADMIN_PASSWORD = getattr(settings, "NEXTCLOUD_ADMIN_PASSWORD", "super-admin@2026!")

OCS_HEADERS = {
    "OCS-APIREQUEST": "true",
    "Content-Type": "application/x-www-form-urlencoded",
}


def _auth() -> tuple[str, str]:
    return (NEXTCLOUD_ADMIN_USER, NEXTCLOUD_ADMIN_PASSWORD)


async def create_user(user_id: str, display_name: str, email: str, password: str) -> dict[str, Any]:
    """Provision a Nextcloud user mirroring our Urban ERP user."""
    async with httpx.AsyncClient(base_url=NEXTCLOUD_BASE_URL, timeout=10.0) as client:
        resp = await client.post(
            "/ocs/v1.php/cloud/users?format=json",
            data={"userid": user_id, "displayName": display_name, "email": email, "password": password},
            headers=OCS_HEADERS,
            auth=_auth(),
        )
        resp.raise_for_status()
        return resp.json()


async def create_share(
    path: str,
    share_type: int = 3,  # 0=user, 1=group, 3=public link
    permissions: int = 1,  # 1=read, 2=update, 4=create, 8=delete, 16=share, 31=all
    password: str | None = None,
    expire_date: str | None = None,
    share_with: str | None = None,
) -> dict[str, Any]:
    """Create a Nextcloud share via OCS API."""
    data: dict[str, Any] = {
        "path": path,
        "shareType": share_type,
        "permissions": permissions,
    }
    if password:
        data["password"] = password
    if expire_date:
        data["expireDate"] = expire_date
    if share_with:
        data["shareWith"] = share_with

    async with httpx.AsyncClient(base_url=NEXTCLOUD_BASE_URL, timeout=10.0) as client:
        resp = await client.post(
            "/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json",
            data=data,
            headers=OCS_HEADERS,
            auth=_auth(),
        )
        resp.raise_for_status()
        return resp.json()


async def delete_share(share_id: int) -> None:
    """Delete a Nextcloud share."""
    async with httpx.AsyncClient(base_url=NEXTCLOUD_BASE_URL, timeout=10.0) as client:
        resp = await client.delete(
            f"/ocs/v2.php/apps/files_sharing/api/v1/shares/{share_id}?format=json",
            headers=OCS_HEADERS,
            auth=_auth(),
        )
        resp.raise_for_status()


async def list_shares(path: str | None = None) -> list[dict[str, Any]]:
    """List shares, optionally filtered by path."""
    params: dict[str, str] = {"format": "json"}
    if path:
        params["path"] = path

    async with httpx.AsyncClient(base_url=NEXTCLOUD_BASE_URL, timeout=10.0) as client:
        resp = await client.get(
            "/ocs/v2.php/apps/files_sharing/api/v1/shares",
            params=params,
            headers=OCS_HEADERS,
            auth=_auth(),
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("ocs", {}).get("data", [])


async def upload_file_webdav(user_id: str, remote_path: str, file_data: bytes) -> bool:
    """Upload a file via WebDAV to a user's Nextcloud files."""
    url = f"/remote.php/dav/files/{user_id}/{remote_path}"
    async with httpx.AsyncClient(base_url=NEXTCLOUD_BASE_URL, timeout=30.0) as client:
        resp = await client.put(url, content=file_data, auth=_auth())
        return resp.status_code in (200, 201, 204)


async def create_folder_webdav(user_id: str, remote_path: str) -> bool:
    """Create a folder via WebDAV."""
    url = f"/remote.php/dav/files/{user_id}/{remote_path}"
    async with httpx.AsyncClient(base_url=NEXTCLOUD_BASE_URL, timeout=10.0) as client:
        resp = await client.request("MKCOL", url, auth=_auth())
        return resp.status_code in (200, 201, 204)


async def health_check() -> bool:
    """Check if Nextcloud is reachable."""
    try:
        async with httpx.AsyncClient(base_url=NEXTCLOUD_BASE_URL, timeout=5.0) as client:
            resp = await client.get("/status.php")
            return resp.status_code == 200
    except Exception:
        return False
