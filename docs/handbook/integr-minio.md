---
title: MinIO File Storage
slug: integr-minio
category: integrations
article_type: guide
module: drive
tags: [minio, storage, files, s3, backup, uploads]
sort_order: 3
is_pinned: false
excerpt: Urban ERP uses MinIO as its S3-compatible file storage engine for all uploaded documents, images, and media.
---

# MinIO File Storage

MinIO (`urban-erp-minio`) is Urban ERP's file storage engine — an open-source, S3-compatible object store. All files stay on your server.

## What Gets Stored in MinIO

Every file uploaded anywhere in Urban ERP goes to MinIO:

- Drive files and folders
- Invoice PDFs and email attachments
- Employee documents (contracts, ID copies)
- Product images (E-Commerce)
- Profile photos
- Recordings from Jitsi meetings

All objects live in the `urban-erp-files` bucket with module-specific path prefixes (e.g. `drive/user-id/filename`, `finance/invoices/invoice-123.pdf`).

## Accessing the MinIO Console

The MinIO Console is at `http://yourserver:9011` by default. Log in with:
- **Username:** value of `MINIO_ROOT_USER` from your `.env`
- **Password:** value of `MINIO_ROOT_PASSWORD` from your `.env`

Use the console to browse objects, check disk usage, and configure lifecycle rules.

## Storage Monitoring

MinIO doesn't enforce quotas by default. Monitor disk usage:

```bash
# From the MinIO console — Metrics tab
# Or from the server:
df -h
```

Urban ERP sends the Super Admin an in-app alert when disk usage exceeds 85%.

## Backing Up Files

Use the MinIO Client (`mc`) to mirror files to a backup location:

```bash
# Install mc and configure
mc alias set urban-erp http://localhost:9010 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD

# Mirror to local backup directory
mc mirror urban-erp/urban-erp-files /backup/minio-files/

# Mirror to another MinIO server (off-site backup)
mc mirror urban-erp/urban-erp-files offsite-minio/urban-erp-backup/
```

## Restoring Files

```bash
mc mirror /backup/minio-files/ urban-erp/urban-erp-files
```

## Presigned URLs

Urban ERP generates time-limited presigned URLs for file downloads (default: 1 hour). Files are **not** publicly accessible — every download goes through the backend which verifies the user's permissions before generating the link.

## Large Files

MinIO handles files of any size. The 1 MB limit in `.pre-commit-config.yaml` is a git repository guard to prevent committing binary assets to the codebase — it has nothing to do with file storage limits.

> **Tip:** Don't delete files directly from the MinIO console unless you know the file is orphaned. Urban ERP stores file references in the database — deleting the object breaks those links and causes 404 errors in the UI.
