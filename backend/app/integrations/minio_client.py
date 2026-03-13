"""MinIO object-storage integration using boto3.

Provides helpers to:
- upload files into user-scoped prefixes
- generate pre-signed download URLs (1 hour)
- list objects within a prefix/folder
- delete objects
- "create" a folder (by writing an empty marker object)

All storage lives inside a single bucket (``urban-vibes-dynamics-drive``).  Object keys
follow the pattern::

    <user_id>/<folder_path>/<filename>
"""
from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone
from typing import Any

try:
    import boto3
    from botocore.client import Config

    _BOTO3_AVAILABLE = True
except ImportError:  # pragma: no cover
    _BOTO3_AVAILABLE = False

from app.core.config import settings

BUCKET_NAME = "urban-vibes-dynamics-drive"
PRESIGNED_EXPIRY = 3600  # 1 hour in seconds


def _get_client() -> Any:
    """Return an initialised boto3 S3 client pointed at MinIO."""
    if not _BOTO3_AVAILABLE:
        raise RuntimeError("boto3 is not installed.  Add boto3==1.35.36 to requirements.txt")

    return boto3.client(
        "s3",
        endpoint_url=settings.MINIO_URL,
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},  # force path-style: http://minio:9000/bucket/key
        ),
        region_name="us-east-1",
    )


def _ensure_bucket(client: Any) -> None:
    """Create the drive bucket if it does not exist yet."""
    try:
        client.head_bucket(Bucket=BUCKET_NAME)
    except Exception:
        try:
            client.create_bucket(Bucket=BUCKET_NAME)
        except Exception:
            pass


def _build_key(user_id: str, folder_path: str, filename: str) -> str:
    folder = folder_path.strip("/") if folder_path else ""
    parts = [str(user_id)]
    if folder:
        parts.append(folder)
    parts.append(filename)
    return "/".join(parts)


# ── Public API ─────────────────────────────────────────────────────────────────

def upload_file(
    file_data: bytes,
    filename: str,
    user_id: str,
    folder_path: str = "",
    content_type: str = "application/octet-stream",
) -> dict[str, Any]:
    """Upload ``file_data`` to MinIO and return a file-record dict.

    Returns
    -------
    dict with keys: ``file_id``, ``filename``, ``minio_key``, ``size``,
    ``content_type``, ``folder_path``, ``owner_id``, ``created_at``.
    """
    file_id = str(uuid.uuid4())
    key = _build_key(user_id, folder_path, f"{file_id}_{filename}")
    size = len(file_data)

    client = _get_client()
    _ensure_bucket(client)
    client.put_object(
        Bucket=BUCKET_NAME,
        Key=key,
        Body=io.BytesIO(file_data),
        ContentType=content_type,
        ContentLength=size,
    )

    return {
        "file_id": file_id,
        "filename": filename,
        "minio_key": key,
        "size": size,
        "content_type": content_type,
        "folder_path": folder_path or "/",
        "owner_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def upload_file_from_bytes(
    data: bytes,
    object_name: str,
    content_type: str = "application/octet-stream",
) -> dict[str, Any]:
    """Upload raw bytes to a specific MinIO object key (no user prefix)."""
    client = _get_client()
    _ensure_bucket(client)
    client.put_object(
        Bucket=BUCKET_NAME,
        Key=object_name,
        Body=io.BytesIO(data),
        ContentType=content_type,
        ContentLength=len(data),
    )
    return {
        "minio_key": object_name,
        "size": len(data),
        "content_type": content_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def get_download_url(minio_key: str, *, internal: bool = False) -> str:
    """Return a pre-signed URL valid for 1 hour for the given MinIO object key.

    The URL is rewritten to use ``MINIO_EXTERNAL_URL`` so browsers can reach it,
    unless *internal* is True (used when the URL must be reachable from within
    Docker, e.g. by the ONLYOFFICE Document Server).
    """
    client = _get_client()
    url: str = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET_NAME, "Key": minio_key},
        ExpiresIn=PRESIGNED_EXPIRY,
    )
    # Rewrite internal Docker hostname to the browser-reachable external URL
    if not internal and settings.MINIO_EXTERNAL_URL and settings.MINIO_EXTERNAL_URL != settings.MINIO_URL:
        url = url.replace(settings.MINIO_URL, settings.MINIO_EXTERNAL_URL, 1)
    return url


def list_files(user_id: str, folder_path: str = "") -> list[dict[str, Any]]:
    """List file objects belonging to ``user_id`` under ``folder_path``.

    Returns a list of dicts with keys: ``minio_key``, ``filename``, ``size``,
    ``last_modified``.
    """
    client = _get_client()
    _ensure_bucket(client)

    prefix = f"{user_id}/"
    if folder_path:
        prefix += folder_path.strip("/") + "/"

    results: list[dict[str, Any]] = []
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix=prefix):
        for obj in page.get("Contents", []):
            key: str = obj["Key"]
            # Skip folder markers
            if key.endswith("/"):
                continue
            # Extract original filename from key (strip uuid prefix)
            basename = key.rsplit("/", 1)[-1]
            # Format: <uuid>_<original_name>  (see upload_file)
            original_name = basename.split("_", 1)[-1] if "_" in basename else basename
            results.append({
                "minio_key": key,
                "filename": original_name,
                "size": obj.get("Size", 0),
                "last_modified": obj.get("LastModified", "").isoformat()
                if hasattr(obj.get("LastModified", ""), "isoformat")
                else str(obj.get("LastModified", "")),
            })
    return results


def delete_file(minio_key: str) -> bool:
    """Delete the object at ``minio_key``.  Returns ``True`` on success."""
    try:
        client = _get_client()
        client.delete_object(Bucket=BUCKET_NAME, Key=minio_key)
        return True
    except Exception:
        return False


def create_folder_marker(user_id: str, folder_path: str) -> dict[str, Any]:
    """Write an empty marker object so the folder appears in listings.

    Returns a folder-record dict with keys: ``folder_path``, ``owner_id``,
    ``created_at``.
    """
    key = f"{user_id}/{folder_path.strip('/')}/"
    client = _get_client()
    _ensure_bucket(client)
    client.put_object(Bucket=BUCKET_NAME, Key=key, Body=b"")
    return {
        "folder_path": folder_path,
        "owner_id": user_id,
        "minio_key": key,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
