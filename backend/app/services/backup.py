"""Backup service for Urban ERP — PostgreSQL dumps stored in MinIO."""

from __future__ import annotations

import gzip
import io
import logging
import subprocess
from datetime import datetime, timezone
from urllib.parse import urlparse

import boto3
from botocore.config import Config as BotoConfig

from app.core.config import settings

logger = logging.getLogger(__name__)

BACKUP_BUCKET = "urban-erp-backups"


class BackupService:
    """Manage PostgreSQL backups stored in MinIO (S3-compatible)."""

    def __init__(self) -> None:
        parsed = urlparse(settings.MINIO_URL)
        self.s3 = boto3.client(
            "s3",
            endpoint_url=settings.MINIO_URL,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=BotoConfig(signature_version="s3v4"),
            region_name="us-east-1",
        )
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        """Create the backup bucket if it does not exist."""
        try:
            self.s3.head_bucket(Bucket=BACKUP_BUCKET)
        except Exception:
            try:
                self.s3.create_bucket(Bucket=BACKUP_BUCKET)
                logger.info("Created backup bucket: %s", BACKUP_BUCKET)
            except Exception:
                logger.exception("Failed to create backup bucket")

    def _parse_db_url(self) -> dict[str, str]:
        """Extract host, port, user, password, dbname from DATABASE_URL."""
        # DATABASE_URL format: postgresql+asyncpg://user:pass@host:port/dbname
        url = settings.DATABASE_URL
        # Strip the +asyncpg driver suffix for parsing
        url = url.replace("+asyncpg", "")
        parsed = urlparse(url)
        return {
            "host": parsed.hostname or "postgres",
            "port": str(parsed.port or 5432),
            "user": parsed.username or "urban",
            "password": parsed.password or "",
            "dbname": parsed.path.lstrip("/") or "urban_erp",
        }

    def create_db_backup(self) -> dict:
        """
        Run pg_dump, gzip the output, and upload to MinIO.

        Returns a dict with backup metadata (filename, size, timestamp).
        """
        db = self._parse_db_url()
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"urban_erp_{timestamp}.sql.gz"

        env = {
            "PGPASSWORD": db["password"],
        }

        logger.info("Starting database backup: %s", filename)

        try:
            result = subprocess.run(
                [
                    "pg_dump",
                    "-h", db["host"],
                    "-p", db["port"],
                    "-U", db["user"],
                    "-d", db["dbname"],
                    "--no-owner",
                    "--no-acl",
                    "--clean",
                    "--if-exists",
                ],
                capture_output=True,
                env=env,
                timeout=600,  # 10 minute timeout
                check=True,
            )
        except subprocess.CalledProcessError as exc:
            logger.error("pg_dump failed: %s", exc.stderr.decode() if exc.stderr else str(exc))
            raise RuntimeError(f"pg_dump failed: {exc.stderr.decode() if exc.stderr else str(exc)}")
        except FileNotFoundError:
            raise RuntimeError("pg_dump not found — ensure PostgreSQL client tools are installed")

        # Gzip the dump
        compressed = gzip.compress(result.stdout)
        size_bytes = len(compressed)

        # Upload to MinIO
        self.s3.put_object(
            Bucket=BACKUP_BUCKET,
            Key=filename,
            Body=io.BytesIO(compressed),
            ContentLength=size_bytes,
            ContentType="application/gzip",
            Metadata={
                "backup-type": "full",
                "database": db["dbname"],
                "timestamp": timestamp,
            },
        )

        logger.info("Backup uploaded: %s (%d bytes)", filename, size_bytes)

        return {
            "filename": filename,
            "size_bytes": size_bytes,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "bucket": BACKUP_BUCKET,
        }

    def list_backups(self) -> list[dict]:
        """List all backup objects in the backup bucket."""
        try:
            response = self.s3.list_objects_v2(Bucket=BACKUP_BUCKET)
        except Exception:
            logger.exception("Failed to list backups")
            return []

        backups = []
        for obj in response.get("Contents", []):
            backups.append({
                "filename": obj["Key"],
                "size_bytes": obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
            })

        # Sort newest first
        backups.sort(key=lambda b: b["last_modified"], reverse=True)
        return backups

    def delete_backup(self, filename: str) -> bool:
        """Delete a single backup file from MinIO."""
        try:
            self.s3.delete_object(Bucket=BACKUP_BUCKET, Key=filename)
            logger.info("Deleted backup: %s", filename)
            return True
        except Exception:
            logger.exception("Failed to delete backup: %s", filename)
            return False

    def delete_old_backups(
        self,
        keep_daily: int = 7,
        keep_weekly: int = 4,
        keep_monthly: int = 12,
    ) -> dict:
        """
        Retention cleanup: keep the most recent daily, weekly, and monthly backups.

        Strategy:
        - Keep the latest `keep_daily` backups (one per day for last N days)
        - Keep one per week for the last `keep_weekly` weeks
        - Keep one per month for the last `keep_monthly` months
        - Delete everything else
        """
        from datetime import timedelta

        backups = self.list_backups()
        if not backups:
            return {"kept": 0, "deleted": 0}

        now = datetime.now(timezone.utc)
        keep_set: set[str] = set()

        # Parse dates from filenames (urban_erp_YYYYMMDD_HHMMSS.sql.gz)
        dated_backups = []
        for b in backups:
            try:
                # Extract date from filename
                parts = b["filename"].replace("urban_erp_", "").replace(".sql.gz", "")
                dt = datetime.strptime(parts, "%Y%m%d_%H%M%S").replace(tzinfo=timezone.utc)
                dated_backups.append((dt, b["filename"]))
            except (ValueError, IndexError):
                # Keep backups we can't parse
                keep_set.add(b["filename"])

        # Sort newest first
        dated_backups.sort(key=lambda x: x[0], reverse=True)

        # Keep daily (most recent N)
        for dt, fname in dated_backups[:keep_daily]:
            keep_set.add(fname)

        # Keep weekly (one per week)
        weekly_kept = 0
        seen_weeks: set[str] = set()
        for dt, fname in dated_backups:
            week_key = dt.strftime("%Y-W%W")
            if week_key not in seen_weeks and weekly_kept < keep_weekly:
                keep_set.add(fname)
                seen_weeks.add(week_key)
                weekly_kept += 1

        # Keep monthly (one per month)
        monthly_kept = 0
        seen_months: set[str] = set()
        for dt, fname in dated_backups:
            month_key = dt.strftime("%Y-%m")
            if month_key not in seen_months and monthly_kept < keep_monthly:
                keep_set.add(fname)
                seen_months.add(month_key)
                monthly_kept += 1

        # Delete the rest
        deleted = 0
        for dt, fname in dated_backups:
            if fname not in keep_set:
                if self.delete_backup(fname):
                    deleted += 1

        logger.info("Retention cleanup: kept %d, deleted %d", len(keep_set), deleted)
        return {"kept": len(keep_set), "deleted": deleted}
