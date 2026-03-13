# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Urban Vibes Dynamics — a fully self-hosted ERP platform consolidating Microsoft 365 + Google Workspace + ERP into a single Docker Compose stack. Zero external API dependencies for core functionality.

## Commands

### Docker Development (primary workflow)

```bash
# Start all services
docker compose up -d --build

# Apply database migrations
docker compose exec backend alembic upgrade head

# View logs
docker compose logs -f backend frontend
```

### Local Development (outside Docker)

```bash
# Infrastructure only
docker compose up -d postgres redis minio ollama

# Backend (terminal 1)
cd backend && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (terminal 2)
cd frontend && npm install && npm run dev
```

### Testing

```bash
# Backend — all tests (pytest + pytest-asyncio, async auto mode, coverage enabled by default)
docker compose exec backend pytest

# Backend — single file
docker compose exec backend pytest tests/test_finance.py

# Backend — single test
docker compose exec backend pytest tests/test_finance.py::test_create_invoice -v

# Frontend — all tests
cd frontend && npx vitest run --reporter=default
```

### Linting & Type Checking

```bash
# Backend lint
ruff check backend/

# Backend format
ruff format backend/

# Frontend type check
cd frontend && npx tsc --noEmit
```

### Database Migrations

```bash
# Auto-generate migration from model changes
docker compose exec backend alembic revision --autogenerate -m "description_of_change"

# Apply migrations
docker compose exec backend alembic upgrade head
```

## Architecture

### Stack

- **Frontend:** React 18 + TypeScript + Vite + TanStack Query + Zustand + Tailwind + Radix UI
- **Backend:** Python 3.12 + FastAPI + SQLAlchemy 2.0 async (asyncpg) + Alembic
- **Database:** PostgreSQL 16 (pgvector) + Redis 7
- **Background jobs:** Celery + Redis (broker on db 1, results on db 2)
- **AI:** Ollama (primary, local) with OpenAI/Anthropic/Grok fallback
- **File storage:** MinIO (S3-compatible)
- **Integrations:** Built-in (SMTP/IMAP + PostgreSQL mail storage), ONLYOFFICE (docs engine, kept forever), Jitsi (video engine, kept forever)
- **Analytics:** Built-in (direct PostgreSQL queries, replaces Superset)

### Backend Structure

```
backend/app/
├── api/v1/           # Routers (198 files) — thin HTTP layer, one per module
├── models/           # SQLAlchemy models (78 files) — one per domain
├── schemas/          # Pydantic schemas — request/response validation
├── services/         # Business logic (ai.py, ai_tools.py, auth.py, etc.)
├── core/             # Shared utilities — NEVER import from module code
│   ├── config.py     # Pydantic Settings (95 env vars)
│   ├── deps.py       # DI: CurrentUser, SuperAdminUser, DBSession
│   ├── database.py   # Async engine + AsyncSessionLocal
│   ├── events.py     # Redis pub/sub EventBus
│   ├── rbac.py       # Role-based access control
│   ├── rate_limit.py # slowapi Redis-backed limiter
│   └── export.py     # CSV export helper
├── integrations/     # External service wrappers (minio, smtp/imap, jitsi, onlyoffice)
└── tasks/            # Celery async jobs + beat schedule
```

**Key dependency injection types** (from `core/deps.py`):
- `CurrentUser` — authenticated user from JWT
- `SuperAdminUser` — requires super-admin role
- `DBSession` — async SQLAlchemy session
- `require_app_admin(app_name)` — factory for app-scoped admin checks

**Event bus** (`core/events.py`): Redis pub/sub for cross-module reactions. Handlers registered in `main.py` lifespan. Example: `meeting.created` auto-creates a calendar event.

**Router registration:** All routers registered in `api/v1/__init__.py`.

### Frontend Structure

```
frontend/src/
├── api/              # API clients (100 files) — Axios + TanStack Query hooks
├── features/         # Feature modules (29 dirs) — pages + module components
├── components/
│   ├── ui/           # Radix UI primitives (Button, Dialog, etc.)
│   ├── layout/       # AppShell, Header, Sidebar, SearchModal, NotificationsDropdown
│   └── ai/           # AI chat UI
├── store/            # Zustand (auth store only — TanStack Query handles server state)
├── hooks/            # Custom hooks
└── utils/            # Helpers (lazy routes, role-based redirect)
```

**Path alias:** `@/` maps to `./src/` (configured in vite.config.ts and tsconfig.json).

**Routing:** All feature pages lazy-loaded in `App.tsx`. Auth guards on protected routes.

**API pattern:** Each `api/*.ts` file exports functions calling Axios and hooks wrapping them with TanStack Query.

### RBAC Model

Three-tier: **Super Admin** (full system) → **App Admin** (scoped to one module, e.g., Finance Admin) → **User** (permission-based via roles).

### Adding a New Module

1. Create model in `backend/app/models/newmodule.py`
2. Import all model classes in `backend/app/models/__init__.py` and add them to `__all__`
3. Create router in `backend/app/api/v1/newmodule.py` (**do not** use `from __future__ import annotations`)
4. Register router in `backend/app/api/v1/__init__.py`
5. Generate + apply migration: `alembic revision --autogenerate -m "add_newmodule"` then `alembic upgrade head`
6. Create API client in `frontend/src/api/newmodule.ts`
7. Create page in `frontend/src/features/newmodule/` and add lazy route in `App.tsx`
8. Run `python3 scripts/audit/run_all_checks.py` — all checks must pass
9. (Optional) Add AI tools in `backend/app/services/ai_tools.py`

### Parity Audit

Run `python3 scripts/audit/run_all_checks.py` to verify database-backend-frontend parity. Individual checks:

```bash
python3 scripts/audit/check_alembic_dupes.py       # No duplicate revision IDs
python3 scripts/audit/check_model_imports.py        # All model files imported
python3 scripts/audit/check_router_registration.py  # All routers registered
python3 scripts/audit/check_sidebar_routes.py       # Sidebar → route parity
python3 scripts/audit/check_future_annotations.py   # No from __future__ in routers
```

Super Admin parity dashboard: `GET /api/v1/admin/parity` (frontend at `/admin/parity`).

### Design Tokens

- Primary: `#51459d` | Success: `#6fd943` | Info: `#3ec9d6` | Warning: `#ffa21d` | Danger: `#ff3a6e`
- Font: Open Sans | Border radius: 10px

## Service Ports (Development)

| Service | Port |
|---------|------|
| Frontend | 3010 |
| Backend API (Swagger at /docs) | 8010 |
| PostgreSQL | 5433 |
| Redis | 6380 |
| MinIO API / Console | 9010 / 9011 |
| Ollama | 11435 |
| ONLYOFFICE | 8083 |
