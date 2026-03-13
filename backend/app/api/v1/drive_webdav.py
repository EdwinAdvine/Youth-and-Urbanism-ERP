"""WebDAV endpoint for Y&U Drive — allows native OS mounting via Finder / Windows Explorer.

Mount URL: http://localhost:8010/api/v1/drive/webdav/
Auth:      Basic Authentication (username + JWT token as password)

Supports: PROPFIND, GET, PUT, DELETE, MKCOL, MOVE, COPY, OPTIONS
"""

import uuid
from datetime import datetime, timezone
from typing import Any
from xml.etree.ElementTree import Element, SubElement, tostring

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.deps import get_current_user
from app.models.drive import DriveFile, DriveFolder
from app.models.user import User

router = APIRouter()

WEBDAV_NS = "DAV:"
WEBDAV_XMLNS = {"d": WEBDAV_NS}


# ── Auth helper ────────────────────────────────────────────────────────────────


async def _get_user_from_basic_auth(request: Request) -> User:
    """Extract user from Basic Auth header. Password = JWT token."""
    import base64
    from app.core.security import decode_access_token

    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Basic "):
        raise HTTPException(401, "Unauthorized", headers={"WWW-Authenticate": 'Basic realm="Y&U Drive"'})

    try:
        decoded = base64.b64decode(auth[6:]).decode("utf-8")
        _username, token = decoded.split(":", 1)
    except Exception:
        raise HTTPException(401, "Invalid credentials")

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid token")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(401, "User not found")
        return user


# ── XML helpers ────────────────────────────────────────────────────────────────


def _dav_element(tag: str, text: str | None = None) -> Element:
    el = Element(f"{{{WEBDAV_NS}}}{tag}")
    if text is not None:
        el.text = text
    return el


def _propfind_response(
    href: str,
    display_name: str,
    is_collection: bool,
    content_type: str = "application/octet-stream",
    content_length: int = 0,
    last_modified: datetime | None = None,
    etag: str | None = None,
) -> Element:
    """Build a single <D:response> element for a PROPFIND reply."""
    response = _dav_element("response")
    href_el = _dav_element("href", href)
    response.append(href_el)

    propstat = _dav_element("propstat")
    prop = _dav_element("prop")
    prop.append(_dav_element("displayname", display_name))

    if is_collection:
        resourcetype = _dav_element("resourcetype")
        resourcetype.append(_dav_element("collection"))
        prop.append(resourcetype)
    else:
        prop.append(_dav_element("resourcetype"))
        prop.append(_dav_element("getcontenttype", content_type))
        prop.append(_dav_element("getcontentlength", str(content_length)))
        if etag:
            prop.append(_dav_element("getetag", f'"{etag}"'))

    lm = last_modified or datetime.now(timezone.utc)
    prop.append(_dav_element("getlastmodified", lm.strftime("%a, %d %b %Y %H:%M:%S GMT")))
    prop.append(_dav_element("creationdate", lm.isoformat()))

    propstat.append(prop)
    propstat.append(_dav_element("status", "HTTP/1.1 200 OK"))
    response.append(propstat)
    return response


def _multistatus(*responses: Element) -> bytes:
    multistatus = _dav_element("multistatus")
    for r in responses:
        multistatus.append(r)
    return b'<?xml version="1.0" encoding="utf-8"?>' + tostring(multistatus, xml_declaration=False)


# ── WebDAV routes ─────────────────────────────────────────────────────────────


@router.options("/webdav/{path:path}")
@router.options("/webdav")
async def webdav_options(path: str = "") -> Response:
    """WebDAV OPTIONS — announce supported methods."""
    return Response(
        status_code=200,
        headers={
            "Allow": "OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, PROPFIND, PROPPATCH",
            "DAV": "1, 2",
            "MS-Author-Via": "DAV",
        },
    )


@router.api_route("/webdav", methods=["PROPFIND"])
@router.api_route("/webdav/", methods=["PROPFIND"])
@router.api_route("/webdav/{path:path}", methods=["PROPFIND"])
async def webdav_propfind(request: Request, path: str = "") -> Response:
    """List folder contents or get file properties."""
    user = await _get_user_from_basic_auth(request)
    depth = request.headers.get("Depth", "1")  # 0 = self only, 1 = children

    # Strip leading/trailing slashes, split path
    parts = [p for p in path.strip("/").split("/") if p]

    async with AsyncSessionLocal() as db:
        responses = []
        base_url = str(request.base_url).rstrip("/") + "/api/v1/drive/webdav"

        if not parts:
            # Root folder listing
            responses.append(_propfind_response(
                href=f"{base_url}/",
                display_name="Y&U Drive",
                is_collection=True,
            ))

            if depth == "1":
                # List root-level folders
                folder_result = await db.execute(
                    select(DriveFolder).where(
                        DriveFolder.owner_id == user.id,
                        DriveFolder.parent_id.is_(None),
                    )
                )
                for folder in folder_result.scalars().all():
                    responses.append(_propfind_response(
                        href=f"{base_url}/{folder.name}/",
                        display_name=folder.name,
                        is_collection=True,
                        last_modified=folder.created_at,
                    ))

                # List root-level files
                file_result = await db.execute(
                    select(DriveFile).where(
                        DriveFile.owner_id == user.id,
                        DriveFile.folder_id.is_(None),
                    )
                )
                for file in file_result.scalars().all():
                    responses.append(_propfind_response(
                        href=f"{base_url}/{file.name}",
                        display_name=file.name,
                        is_collection=False,
                        content_type=file.content_type,
                        content_length=file.size or 0,
                        last_modified=file.updated_at,
                        etag=file.content_hash or str(file.id)[:8],
                    ))
        else:
            # Navigate into folder path
            current_folder_id = None
            for part in parts[:-1]:
                folder_result = await db.execute(
                    select(DriveFolder).where(
                        DriveFolder.owner_id == user.id,
                        DriveFolder.name == part,
                        DriveFolder.parent_id == current_folder_id,
                    )
                )
                folder = folder_result.scalar_one_or_none()
                if not folder:
                    return Response(status_code=404)
                current_folder_id = folder.id

            last = parts[-1]

            # Check if it's a folder
            folder_result = await db.execute(
                select(DriveFolder).where(
                    DriveFolder.owner_id == user.id,
                    DriveFolder.name == last,
                    DriveFolder.parent_id == current_folder_id,
                )
            )
            folder = folder_result.scalar_one_or_none()

            if folder:
                href_base = f"{base_url}/{'/'.join(parts)}/"
                responses.append(_propfind_response(
                    href=href_base,
                    display_name=folder.name,
                    is_collection=True,
                    last_modified=folder.created_at,
                ))

                if depth == "1":
                    child_folders = await db.execute(
                        select(DriveFolder).where(
                            DriveFolder.owner_id == user.id,
                            DriveFolder.parent_id == folder.id,
                        )
                    )
                    for cf in child_folders.scalars().all():
                        responses.append(_propfind_response(
                            href=f"{href_base}{cf.name}/",
                            display_name=cf.name,
                            is_collection=True,
                            last_modified=cf.created_at,
                        ))

                    child_files = await db.execute(
                        select(DriveFile).where(
                            DriveFile.owner_id == user.id,
                            DriveFile.folder_id == folder.id,
                        )
                    )
                    for f in child_files.scalars().all():
                        responses.append(_propfind_response(
                            href=f"{href_base}{f.name}",
                            display_name=f.name,
                            is_collection=False,
                            content_type=f.content_type,
                            content_length=f.size or 0,
                            last_modified=f.updated_at,
                            etag=f.content_hash or str(f.id)[:8],
                        ))
            else:
                # Check if it's a file
                file_result = await db.execute(
                    select(DriveFile).where(
                        DriveFile.owner_id == user.id,
                        DriveFile.name == last,
                        DriveFile.folder_id == current_folder_id,
                    )
                )
                file = file_result.scalar_one_or_none()
                if not file:
                    return Response(status_code=404)

                responses.append(_propfind_response(
                    href=f"{base_url}/{'/'.join(parts)}",
                    display_name=file.name,
                    is_collection=False,
                    content_type=file.content_type,
                    content_length=file.size or 0,
                    last_modified=file.updated_at,
                    etag=file.content_hash or str(file.id)[:8],
                ))

    xml = _multistatus(*responses)
    return Response(
        content=xml,
        status_code=207,
        media_type="application/xml; charset=utf-8",
        headers={"Content-Type": "application/xml; charset=utf-8"},
    )


@router.api_route("/webdav/{path:path}", methods=["GET", "HEAD"])
async def webdav_get(request: Request, path: str) -> Response:
    """Download a file via WebDAV."""
    user = await _get_user_from_basic_auth(request)
    parts = [p for p in path.strip("/").split("/") if p]
    if not parts:
        return Response(status_code=400)

    async with AsyncSessionLocal() as db:
        # Navigate folder path
        current_folder_id = None
        for part in parts[:-1]:
            folder_result = await db.execute(
                select(DriveFolder).where(
                    DriveFolder.owner_id == user.id,
                    DriveFolder.name == part,
                    DriveFolder.parent_id == current_folder_id,
                )
            )
            folder = folder_result.scalar_one_or_none()
            if not folder:
                return Response(status_code=404)
            current_folder_id = folder.id

        file_result = await db.execute(
            select(DriveFile).where(
                DriveFile.owner_id == user.id,
                DriveFile.name == parts[-1],
                DriveFile.folder_id == current_folder_id,
            )
        )
        file = file_result.scalar_one_or_none()
        if not file:
            return Response(status_code=404)

    if request.method == "HEAD":
        return Response(
            status_code=200,
            headers={
                "Content-Length": str(file.size or 0),
                "Content-Type": file.content_type,
                "ETag": f'"{file.content_hash or str(file.id)[:8]}"',
            },
        )

    # Stream file from MinIO
    from app.integrations.minio_client import minio_client
    try:
        data = minio_client.download(file.minio_key)
        return Response(
            content=data,
            media_type=file.content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{file.name}"',
                "ETag": f'"{file.content_hash or str(file.id)[:8]}"',
            },
        )
    except Exception:
        return Response(status_code=404)


@router.api_route("/webdav/{path:path}", methods=["PUT"])
async def webdav_put(request: Request, path: str) -> Response:
    """Upload or overwrite a file via WebDAV."""
    user = await _get_user_from_basic_auth(request)
    parts = [p for p in path.strip("/").split("/") if p]
    if not parts:
        return Response(status_code=400)

    content_type = request.headers.get("Content-Type", "application/octet-stream")
    data = await request.body()

    async with AsyncSessionLocal() as db:
        # Navigate/create folder path
        current_folder_id = None
        for part in parts[:-1]:
            folder_result = await db.execute(
                select(DriveFolder).where(
                    DriveFolder.owner_id == user.id,
                    DriveFolder.name == part,
                    DriveFolder.parent_id == current_folder_id,
                )
            )
            folder = folder_result.scalar_one_or_none()
            if not folder:
                folder = DriveFolder(name=part, parent_id=current_folder_id, owner_id=user.id)
                db.add(folder)
                await db.flush()
            current_folder_id = folder.id

        filename = parts[-1]

        # Check if file exists (overwrite)
        existing_result = await db.execute(
            select(DriveFile).where(
                DriveFile.owner_id == user.id,
                DriveFile.name == filename,
                DriveFile.folder_id == current_folder_id,
            )
        )
        existing = existing_result.scalar_one_or_none()

        from app.integrations.minio_client import minio_client
        minio_key = f"{user.id}/webdav/{uuid.uuid4()}_{filename}"
        minio_client.upload_bytes(minio_key, data, content_type)

        if existing:
            existing.minio_key = minio_key
            existing.size = len(data)
            existing.content_type = content_type
            existing.updated_at = datetime.now(timezone.utc)
            status = 204
        else:
            drive_file = DriveFile(
                name=filename,
                content_type=content_type,
                size=len(data),
                minio_key=minio_key,
                folder_id=current_folder_id,
                owner_id=user.id,
                folder_path="/".join(parts[:-1]) if len(parts) > 1 else "/",
            )
            db.add(drive_file)
            status = 201

        await db.commit()

    return Response(status_code=status)


@router.api_route("/webdav/{path:path}", methods=["MKCOL"])
async def webdav_mkcol(request: Request, path: str) -> Response:
    """Create a collection (folder) via WebDAV."""
    user = await _get_user_from_basic_auth(request)
    parts = [p for p in path.strip("/").split("/") if p]
    if not parts:
        return Response(status_code=405)

    async with AsyncSessionLocal() as db:
        current_folder_id = None
        for part in parts:
            folder_result = await db.execute(
                select(DriveFolder).where(
                    DriveFolder.owner_id == user.id,
                    DriveFolder.name == part,
                    DriveFolder.parent_id == current_folder_id,
                )
            )
            folder = folder_result.scalar_one_or_none()
            if not folder:
                folder = DriveFolder(name=part, parent_id=current_folder_id, owner_id=user.id)
                db.add(folder)
                await db.flush()
            current_folder_id = folder.id

        await db.commit()

    return Response(status_code=201)


@router.api_route("/webdav/{path:path}", methods=["DELETE"])
async def webdav_delete(request: Request, path: str) -> Response:
    """Delete a file or folder via WebDAV."""
    user = await _get_user_from_basic_auth(request)
    parts = [p for p in path.strip("/").split("/") if p]
    if not parts:
        return Response(status_code=400)

    async with AsyncSessionLocal() as db:
        current_folder_id = None
        for part in parts[:-1]:
            folder_result = await db.execute(
                select(DriveFolder).where(
                    DriveFolder.owner_id == user.id,
                    DriveFolder.name == part,
                    DriveFolder.parent_id == current_folder_id,
                )
            )
            folder = folder_result.scalar_one_or_none()
            if not folder:
                return Response(status_code=404)
            current_folder_id = folder.id

        last = parts[-1]

        # Try folder first
        folder_result = await db.execute(
            select(DriveFolder).where(
                DriveFolder.owner_id == user.id,
                DriveFolder.name == last,
                DriveFolder.parent_id == current_folder_id,
            )
        )
        folder = folder_result.scalar_one_or_none()
        if folder:
            await db.delete(folder)
            await db.commit()
            return Response(status_code=204)

        # Try file
        file_result = await db.execute(
            select(DriveFile).where(
                DriveFile.owner_id == user.id,
                DriveFile.name == last,
                DriveFile.folder_id == current_folder_id,
            )
        )
        file = file_result.scalar_one_or_none()
        if file:
            from app.integrations.minio_client import minio_client
            try:
                minio_client.delete_file(file.minio_key)
            except Exception:
                pass
            await db.delete(file)
            await db.commit()
            return Response(status_code=204)

    return Response(status_code=404)
