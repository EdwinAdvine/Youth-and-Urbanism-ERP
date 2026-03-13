# Urban Vibes Dynamics

A fully self-hosted ERP platform consolidating Microsoft 365 + Google Workspace + enterprise resource planning into a single Docker Compose stack. Zero external API dependencies for core functionality. 100% code ownership.

## Overview

Urban Vibes Dynamics replaces fragmented SaaS tools with one unified, privacy-first platform:

- **Communication** — Email (Stalwart), Video Meetings (Jitsi), Notes (Tiptap)
- **Productivity** — Docs/Excel/PowerPoint (ONLYOFFICE), Calendar (FullCalendar + CalDAV), Forms, Projects (Kanban)
- **File Management** — Drive (MinIO + Nextcloud), SharePoint-level sharing
- **Business Modules** — Finance, HR & Payroll, CRM, Inventory, Supply Chain, Manufacturing, POS, E-Commerce
- **AI Assistant** — Urban Board AI with tool-calling across all modules (configurable providers: OpenAI, Anthropic, Grok)
- **Analytics** — Built-in dashboards with direct PostgreSQL queries

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + TanStack Query + Zustand + Tailwind CSS + Radix UI |
| Backend | Python FastAPI + SQLAlchemy 2.0 (async) + Alembic |
| Database | PostgreSQL 16 + pgvector |
| Queue | Celery + Redis 7 |
| AI | OpenAI / Anthropic / Grok (configurable) |
| File Storage | MinIO (S3-compatible) + Nextcloud |
| Mail | Stalwart (Rust — IMAP/SMTP/JMAP/CalDAV/CardDAV) |
| Office | ONLYOFFICE Document Server |
| Meetings | Jitsi Meet |
| Analytics | Apache Superset |
| Containers | Docker Compose (16 services) |

## Quick Start

```bash
# Clone and enter the project
cd urban-vibes-dynamics

# Copy environment config
cp .env.example .env
# Edit .env with your settings (database credentials, JWT secret, etc.)

# Start all services
docker compose up -d --build

# Run database migrations
docker compose exec backend alembic upgrade head
```

### Service URLs (Development)

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3010 | React application |
| Backend API | http://localhost:8010 | FastAPI + Swagger docs at `/docs` |
| pgAdmin | http://localhost:5051 | Database management |
| MailHog | http://localhost:8026 | Email testing UI |
| Stalwart Admin | http://localhost:8082 | Mail server admin |
| ONLYOFFICE | http://localhost:8083 | Document server |
| Nextcloud | http://localhost:8085 | File sharing |
| Superset | http://localhost:8088 | Analytics dashboards |
| MinIO Console | http://localhost:9011 | Object storage admin |

## Project Structure

```
urban-vibes-dynamics/
├── backend/                    # FastAPI Python application
│   ├── app/
│   │   ├── main.py             # App entry point, lifespan, event handlers
│   │   ├── api/v1/             # 36 registered API routers
│   │   ├── models/             # 29 SQLAlchemy models
│   │   ├── schemas/            # Pydantic validation schemas
│   │   ├── services/           # Business logic (AI, auth, backup, etc.)
│   │   ├── core/               # Shared utilities (config, DB, RBAC, events)
│   │   ├── integrations/       # OSS service wrappers
│   │   └── tasks/              # Celery background jobs
│   ├── tests/                  # 22 pytest test files
│   └── alembic/                # Database migrations
├── frontend/                   # React 18 + TypeScript + Vite
│   └── src/
│       ├── App.tsx             # Router with auth guards
│       ├── api/                # 33 API client modules
│       ├── features/           # 26 feature modules (100+ pages)
│       ├── components/         # Reusable UI components
│       ├── store/              # Zustand state management
│       └── hooks/              # Custom React hooks
├── nginx/                      # Reverse proxy config
├── scripts/                    # Deploy, backup, restore, SSL scripts
├── monitoring/                 # Grafana dashboards
├── superset/                   # Superset configuration
├── docker-compose.yml          # Development stack (16 services)
└── docker-compose.prod.yml     # Production stack
```

## Documentation

- [Architecture Overview](docs/architecture.md) — System design, patterns, and service topology
- [API Reference](docs/api-reference.md) — All 370+ endpoints organized by module
- [Module Guide](docs/modules.md) — Detailed breakdown of each business module
- [Deployment Guide](docs/deployment.md) — Production deployment, SSL, backups
- [Development Guide](docs/development.md) — Local setup, conventions, testing
- [Integration Guide](docs/integrations.md) — OSS service integration details

## RBAC Model

| Role | Scope | Capabilities |
|------|-------|-------------|
| **Super Admin** | Global | Full control — creates admins/users, AI config, global settings, backups |
| **App Admin** | Per-app | Manages users/teams within assigned app (e.g., Finance Admin) |
| **User** | Permission-based | Access based on RBAC role assignments |

## AI — Urban Board

The central AI assistant provides:

- Natural language chat with streaming responses
- Tool-calling across all modules (34 tools — create invoices, schedule meetings, query inventory, etc.)
- RAG with pgvector embeddings for document-aware answers
- Voice input/output
- Configurable provider: OpenAI / Anthropic / Grok
- Full audit log of AI actions

WebSocket endpoint: `ws://localhost:8000/api/v1/ws/chat/{session_id}?token={jwt}`

## Design Tokens

| Token | Value |
|-------|-------|
| Primary | `#51459d` |
| Success | `#6fd943` |
| Info | `#3ec9d6` |
| Warning | `#ffa21d` |
| Danger | `#ff3a6e` |
| Font | Open Sans |
| Border Radius | 10px |

## License

Proprietary — Y&U ERP. All rights reserved.
