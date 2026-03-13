# Drive & Documents Module

> File management, ONLYOFFICE document editing, sharing, and versioning.

## Overview

Y&U Drive provides a Google Drive-like file management system backed by MinIO object storage. Y&U Docs provides Microsoft Office-compatible document editing powered by ONLYOFFICE Document Server. Together they replace SharePoint + OneDrive + Google Drive.

---

## Features

### Drive
- Folder hierarchy with drag-and-drop organization
- File upload, download, rename, move, delete
- File sharing with permissions (view, edit, full control)
- Version history for all files
- Starred/favorites and recent files
- Full-text search across file names and document content
- WebDAV access (mount as network drive)
- AI features: document summarization, content extraction, smart tagging

### Docs
- Create and edit Word (.docx), Excel (.xlsx), PowerPoint (.pptx) files
- Real-time co-editing with ONLYOFFICE Document Server
- Comments, track changes, revision history
- Export to PDF
- Mobile-optimized editor

---

## Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/drive.py` | Core: folders, files, upload, download |
| `backend/app/api/v1/drive_admin.py` | Admin: quota management, user storage |
| `backend/app/api/v1/drive_ai_features.py` | AI document analysis |
| `backend/app/api/v1/drive_phase2.py` | Phase 2 features: versioning, sharing |
| `backend/app/api/v1/drive_webdav.py` | WebDAV mount endpoint |
| `backend/app/api/v1/docs.py` | ONLYOFFICE editor integration |
| `backend/app/api/v1/docs_ext.py` | Document save callbacks and conversion |
| `backend/app/integrations/minio_client.py` | MinIO object storage wrapper |
| `backend/app/integrations/onlyoffice.py` | ONLYOFFICE JWT and editor config |

---

## Storage Architecture

Files are stored in **MinIO** (S3-compatible):
- Bucket: `urban-vibes-dynamics-files`
- Key format: `{user_id}/{folder_path}/{file_uuid}_{original_filename}`
- Access: presigned URLs (1-hour expiry) for downloads
- ONLYOFFICE: fetches file via presigned URL → saves back via callback URL

## Cross-Module Integrations

| Module | Integration |
|--------|-------------|
| Projects | Auto-create Drive folder when project is created |
| Mail | Attach Drive files to emails; save email attachments to Drive |
| HR | Employee documents (contracts, payslips) stored in Drive |
| Finance | Invoice PDFs stored in Drive |
| Manufacturing | Technical drawings linked to BOMs |
