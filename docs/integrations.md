# Integration Guide

Urban Vibes Dynamics integrates five open-source services, all running internally within the Docker Compose stack. No external API calls are made — every service communicates over the internal Docker network.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Docker Network                   │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌───────────┐  │
│  │ Stalwart │    │ONLYOFFICE│    │  Jitsi    │  │
│  │  (Mail)  │    │  (Docs)  │    │ (Meetings)│  │
│  └────┬─────┘    └────┬─────┘    └─────┬─────┘  │
│       │               │               │         │
│       └───────────┬───┴───────────────┘         │
│                   │                              │
│            ┌──────▼──────┐                       │
│            │   FastAPI   │ ◄── Single orchestrator│
│            │  (Backend)  │                       │
│            └──────┬──────┘                       │
│                   │                              │
│       ┌───────────┼───────────┐                  │
│       │           │           │                  │
│  ┌────▼───┐  ┌───▼────┐ ┌───▼──────┐           │
│  │ MinIO  │  │Nextcloud│ │PostgreSQL│           │
│  │(Files) │  │(Sharing)│ │   (DB)   │           │
│  └────────┘  └────────┘ └──────────┘           │
└─────────────────────────────────────────────────┘
```

All integrations are wrapped in Python client classes under `backend/app/integrations/`.

---

## 1. Stalwart Mail Server

**Service:** `stalwart` (Docker image: `stalwartlabs/stalwart`)
**Protocols:** IMAP, SMTP, JMAP, CalDAV, CardDAV, WebDAV
**Integration file:** `backend/app/integrations/stalwart.py`

### What It Does

Stalwart is a modern Rust-based mail server providing complete email, calendar, and contacts infrastructure.

### How We Integrate

Our FastAPI backend acts as a proxy and synchronizer:

**Email:**
- IMAP client fetches inbox/folders for the frontend mail UI
- SMTP sends outgoing messages
- JMAP used for efficient mailbox operations

**Calendar (CalDAV):**
- Calendar events created in Urban Vibes Dynamics are pushed to Stalwart via CalDAV
- Stalwart acts as the CalDAV backend for external calendar app sync (Apple Calendar, Thunderbird, etc.)
- Bi-directional sync via Celery beat schedule

**Contacts (CardDAV):**
- CRM contacts sync to Stalwart's CardDAV store
- Enables contact access from any CardDAV client

### Configuration

```env
STALWART_DOMAIN=urban.local
STALWART_ADMIN_URL=http://stalwart:8080
```

### Event Integration

```
Email received → Parse → Auto-create calendar event (if invite)
                       → Link to CRM contact (if known sender)
                       → AI thread summarization (on demand)
```

### Docker Setup

```yaml
stalwart:
  image: stalwartlabs/stalwart:latest
  ports:
    - "25:25"       # SMTP
    - "143:143"     # IMAP
    - "587:587"     # Submission
    - "993:993"     # IMAPS
    - "8082:8080"   # Admin UI
  volumes:
    - stalwart_data:/opt/stalwart
```

---

## 2. ONLYOFFICE Document Server

**Service:** `onlyoffice` (Docker image: `onlyoffice/documentserver`)
**Integration file:** `backend/app/integrations/onlyoffice.py`

### What It Does

Full Microsoft Office-compatible document editing with real-time collaboration. Handles .docx, .xlsx, .pptx, and more.

### How We Integrate

**Document Flow:**
1. User creates/opens document via Urban Vibes Dynamics frontend
2. Backend generates a JWT-signed editing URL
3. Frontend embeds ONLYOFFICE editor via JS SDK (internal URL)
4. Documents stored in MinIO, referenced by `DocLink` model
5. ONLYOFFICE calls back to our backend for save/load operations

**JWT Authentication:**
All editor sessions are JWT-secured — ONLYOFFICE validates tokens using a shared secret.

### Configuration

```env
ONLYOFFICE_URL=http://onlyoffice
ONLYOFFICE_JWT_SECRET=your-onlyoffice-secret
```

### Cross-Module Links

- Finance reports exportable as Excel via ONLYOFFICE conversion
- HR generates payslip PDFs
- AI generates document content, then opens in ONLYOFFICE for editing
- Version history tracked in Drive module

### Docker Setup

```yaml
onlyoffice:
  image: onlyoffice/documentserver:latest
  ports:
    - "8083:80"
  environment:
    JWT_ENABLED: "true"
    JWT_SECRET: ${ONLYOFFICE_JWT_SECRET}
```

---

## 3. Jitsi Meet

**Service:** 4 containers (`jitsi-web`, `jitsi-prosody`, `jitsi-jicofo`, `jitsi-jvb`)
**Integration file:** `backend/app/integrations/jitsi.py`

### What It Does

Video conferencing with screen sharing, recording, and chat — a self-hosted Microsoft Teams alternative.

### How We Integrate

**Meeting Lifecycle:**
1. User creates meeting via Urban Vibes Dynamics
2. Backend generates unique Jitsi room name + JWT token
3. `meeting.created` event fires → calendar event auto-created
4. Meeting link emailed to attendees via Stalwart
5. Attendees join via embedded Jitsi in frontend
6. Recording (if enabled) saved to MinIO/Drive

**JWT Tokens:**
Jitsi configured for JWT authentication — our backend mints tokens with user info and room permissions.

### Configuration

```env
JITSI_URL=http://jitsi-web:80
JITSI_JWT_SECRET=your-jitsi-secret
```

### Event Flow

```
Create Meeting → event_bus.emit("meeting.created")
                      → Create CalendarEvent
                      → Send email invite via Stalwart
                      → Add to attendees' calendars
```

### Docker Setup

```yaml
jitsi-web:
  image: jitsi/web:stable
  ports:
    - "8080:80"
    - "8443:443"

jitsi-prosody:
  image: jitsi/prosody:stable

jitsi-jicofo:
  image: jitsi/jicofo:stable

jitsi-jvb:
  image: jitsi/jvb:stable
  ports:
    - "10000:10000/udp"  # Media traffic
```

---

## 4. MinIO (S3-Compatible Storage)

**Service:** `minio`
**Integration file:** `backend/app/integrations/minio_client.py`

### What It Does

S3-compatible object storage for all file operations. Every file in Urban Vibes Dynamics ultimately lives in MinIO.

### How We Integrate

**Unified Storage Layer:**
- Drive module: direct file management
- ONLYOFFICE: document storage backend
- Mail: attachment storage
- Forms: file upload responses
- HR: employee documents
- Finance: invoice PDFs, reports

**Operations:**
- `upload_file(bucket, key, data)` — store file
- `download_file(bucket, key)` — retrieve file
- `generate_presigned_url(bucket, key)` — temporary download URLs
- `delete_file(bucket, key)` — remove file

### Configuration

```env
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=urban-vibes-dynamics
```

### Docker Setup

```yaml
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  ports:
    - "9010:9000"   # S3 API
    - "9011:9001"   # Console UI
  volumes:
    - minio_data:/data
```

---

## 5. Nextcloud (Enhanced Sharing)

**Service:** 3 containers (`nextcloud-db`, `nextcloud`, `nextcloud-web`)
**Integration file:** `backend/app/integrations/nextcloud_client.py`

### What It Does

Adds SharePoint-level sharing capabilities beyond what MinIO provides:
- Password-protected share links
- Expiring shares
- Team folders with member management
- Share audit logging

### How We Integrate

**Dual API Access:**
- **OCS API** — Share management (create, update, revoke shares)
- **WebDAV API** — File operations (upload, download, folder management)

**Enhanced Sharing Features (via our models + Nextcloud):**
- `FileShare` model — share settings (password, expiry, max downloads, no-download, approval)
- `TeamFolder` model — team-based folder access
- `ShareAuditLog` — every share action logged

**Flow:**
1. User creates share in Urban Vibes Dynamics UI (ShareDialog component)
2. Backend creates share record in PostgreSQL
3. Backend calls Nextcloud OCS API to create matching share
4. Recipients access via share link → routed through our backend for audit

### Configuration

```env
NEXTCLOUD_URL=http://nextcloud
NEXTCLOUD_ADMIN_USER=admin
NEXTCLOUD_ADMIN_PASSWORD=your-nextcloud-password
```

### Docker Setup

```yaml
nextcloud-db:
  image: mariadb:10.6
  volumes:
    - nextcloud_db_data:/var/lib/mysql

nextcloud:
  image: nextcloud:latest
  volumes:
    - nextcloud_data:/var/www/html

nextcloud-web:
  image: nginx:alpine
  ports:
    - "8085:80"
```

---

## 6. Apache Superset (Analytics)

**Service:** `superset`
**Configuration file:** `superset/superset_config.py`

### What It Does

Business intelligence platform providing interactive dashboards and SQL-based analytics.

### How We Integrate

**Direct Database Access:**
Superset connects directly to Urban Vibes Dynamics's PostgreSQL database — no API layer needed. This provides real-time access to all module data.

**Embedded Dashboards:**
The frontend analytics page embeds Superset dashboards in an iframe (internal URL only).

### Configuration

```env
SUPERSET_URL=http://superset:8088
SUPERSET_ADMIN_USER=admin
SUPERSET_ADMIN_PASSWORD=admin
```

### Docker Setup

```yaml
superset:
  image: apache/superset:latest
  ports:
    - "8088:8088"
  environment:
    SUPERSET_CONFIG_PATH: /app/superset_config.py
```

---

## Cross-Service Event Flows

### Meeting Scheduling
```
User creates meeting
  → Backend: create meeting record
  → event_bus.emit("meeting.created")
  → Handler: create CalendarEvent
  → Handler: push to Stalwart CalDAV
  → Handler: send email invite via Stalwart SMTP
  → Frontend: meeting link in calendar event
```

### File Sharing
```
User shares file
  → Backend: create FileShare record
  → Backend: call Nextcloud OCS API (create share)
  → Backend: log to ShareAuditLog
  → event_bus.emit("file.shared")
  → Handler: create Notification for recipient
```

### Invoice Workflow
```
User sends invoice
  → Backend: update invoice status
  → Backend: generate PDF (python-docx → MinIO)
  → event_bus.emit("invoice.sent")
  → Handler: notify finance admins
  → Handler: send invoice email via Stalwart
  → CRM: update deal status
```

### Leave Approval
```
Manager approves leave
  → Backend: update leave status
  → event_bus.emit("leave.approved")
  → Handler: create CalendarEvent for leave period
  → Handler: push to Stalwart CalDAV
  → Handler: create Notification for employee
```

---

## Health Monitoring

The `/health` endpoint checks connectivity to all integrated services:

```json
{
  "status": "healthy",
  "services": {
    "database": "ok",
    "redis": "ok",
    "minio": "ok",
    "stalwart": "ok",
    "nextcloud": "ok",
    "onlyoffice": "ok"
  }
}
```

Any service returning unhealthy triggers a warning in the Super Admin dashboard.
