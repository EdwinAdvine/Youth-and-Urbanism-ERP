# Development Guide

## Local Setup

### Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Node.js 20+ (for frontend development outside Docker)
- Python 3.12+ (for backend development outside Docker)

### Quick Start (Docker)

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

### Local Development (Outside Docker)

For faster iteration, run backend and frontend locally while keeping infrastructure services in Docker:

```bash
# Start only infrastructure
docker compose up -d postgres redis minio

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Set DATABASE_URL to localhost:5433
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## Project Conventions

### Backend

**File Organization:**
```
backend/app/
├── api/v1/           # Routers — one file per module, thin layer
├── models/           # SQLAlchemy models — one file per domain
├── schemas/          # Pydantic schemas — request/response validation
├── services/         # Business logic — complex operations
├── core/             # Shared utilities — never import from modules
├── integrations/     # External service wrappers
└── tasks/            # Celery async jobs
```

**Naming:**
- Models: `PascalCase` singular (e.g., `Invoice`, `Employee`)
- Tables: `snake_case` plural (e.g., `invoices`, `employees`)
- Routers: `snake_case` module name (e.g., `finance.py`, `hr.py`)
- Endpoints: REST conventions (`GET /items`, `POST /items`, `GET /items/{id}`)

**Patterns:**
- All endpoints use async (`async def`)
- Database sessions via `DBSession` dependency (`core/deps.py`)
- Auth via `CurrentUser` dependency (JWT extraction)
- Admin-only via `SuperAdminUser` dependency
- Rate limiting via `@limiter.limit()` decorator
- Events via `event_bus.emit()` for cross-module side effects

**Example router:**
```python
from fastapi import APIRouter, Depends
from app.core.deps import DBSession, CurrentUser

router = APIRouter(prefix="/module", tags=["module"])

@router.get("/")
async def list_items(db: DBSession, user: CurrentUser):
    result = await db.execute(select(Item).where(Item.owner_id == user.id))
    return result.scalars().all()
```

### Frontend

**File Organization:**
```
frontend/src/
├── api/              # API clients — one file per module
├── features/         # Feature modules — pages + module-specific components
│   └── finance/      # Example: all finance pages
├── components/
│   ├── ui/           # Radix UI primitives (Button, Dialog, etc.)
│   ├── layout/       # Shell, Header, Sidebar
│   └── ai/           # AI chat components
├── store/            # Zustand stores
├── hooks/            # Custom hooks
└── utils/            # Helper functions
```

**Naming:**
- Components: `PascalCase` (e.g., `InvoiceDetail.tsx`)
- API clients: `camelCase` (e.g., `finance.ts`)
- Hooks: `useCamelCase` (e.g., `useAuth.ts`)
- Routes: kebab-case URL paths (e.g., `/finance/invoices`)

**Patterns:**
- TanStack Query for all API data fetching (caching, refetch)
- Zustand for client-only state (auth, UI)
- React Hook Form + Zod for form validation
- Lazy loading for all feature pages (`React.lazy()`)
- Axios instance with JWT interceptor (`api/client.ts`)

**Example API client:**
```typescript
// api/finance.ts
import { api } from './client';

export const getInvoices = (params?: { page?: number }) =>
  api.get('/finance/invoices', { params }).then(r => r.data);

export const createInvoice = (data: CreateInvoiceDto) =>
  api.post('/finance/invoices', data).then(r => r.data);
```

**Example page:**
```tsx
import { useQuery } from '@tanstack/react-query';
import { getInvoices } from '../../api/finance';

export default function InvoicesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => getInvoices(),
  });

  if (isLoading) return <Spinner />;
  return <InvoiceTable data={data} />;
}
```

---

## Database Migrations

### Creating a New Migration

```bash
# Auto-generate from model changes
docker compose exec backend alembic revision --autogenerate -m "description_of_change"

# Apply
docker compose exec backend alembic upgrade head
```

### Migration Best Practices

- Always review auto-generated migrations before applying
- Test migrations on a copy of production data
- Never modify already-applied migrations
- Use descriptive names: `add_tax_brackets_table`, `add_status_to_orders`
- Include both `upgrade()` and `downgrade()` functions

---

## Adding a New Module

### 1. Backend Model

Create `backend/app/models/newmodule.py`:
```python
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class NewEntity(Base):
    __tablename__ = "new_entities"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

### 2. Backend Router

Create `backend/app/api/v1/newmodule.py`:
```python
from fastapi import APIRouter, Depends
from app.core.deps import DBSession, CurrentUser

router = APIRouter(prefix="/newmodule", tags=["newmodule"])

@router.get("/")
async def list_entities(db: DBSession, user: CurrentUser):
    ...
```

### 3. Register Router

In `backend/app/api/v1/__init__.py`:
```python
from .newmodule import router as newmodule_router
api_router.include_router(newmodule_router)
```

### 4. Create Migration

```bash
docker compose exec backend alembic revision --autogenerate -m "add_newmodule"
docker compose exec backend alembic upgrade head
```

### 5. Frontend API Client

Create `frontend/src/api/newmodule.ts`:
```typescript
import { api } from './client';
export const getEntities = () => api.get('/newmodule').then(r => r.data);
```

### 6. Frontend Pages

Create `frontend/src/features/newmodule/NewModulePage.tsx` and add lazy route in `App.tsx`.

### 7. AI Tools (Optional)

Add tool functions in `backend/app/services/ai_tools.py` for AI integration.

---

## Testing

### Running Tests

```bash
# All tests
docker compose exec backend pytest

# With coverage
docker compose exec backend pytest --cov=app --cov-report=term-missing

# Specific test file
docker compose exec backend pytest tests/test_finance.py

# Specific test
docker compose exec backend pytest tests/test_finance.py::test_create_invoice -v
```

### Test Structure

```
backend/tests/
├── conftest.py          # Fixtures: async DB session, test client, auth tokens
├── test_auth.py         # Authentication endpoints
├── test_admin.py        # Admin operations
├── test_finance.py      # Finance module
├── test_hr.py           # HR module
├── test_crm.py          # CRM module
├── test_inventory.py    # Inventory module
├── ...                  # 22 test files total
```

### Writing Tests

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_invoice(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/api/v1/finance/invoices",
        json={"contact_id": 1, "amount": 100.00, "due_date": "2026-04-01"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["amount"] == 100.00
```

---

## Code Quality

### Backend

```bash
# Type checking
pip install mypy
mypy backend/app

# Linting
pip install ruff
ruff check backend/

# Formatting
ruff format backend/
```

### Frontend

```bash
cd frontend

# Type checking
npx tsc --noEmit

# Linting
npx eslint src/

# Formatting
npx prettier --write src/
```

---

## Useful Commands

```bash
# View all running services
docker compose ps

# Restart a single service
docker compose restart backend

# View real-time logs
docker compose logs -f backend frontend

# Access backend shell
docker compose exec backend bash

# Access database
docker compose exec postgres psql -U urban urban_erp

# Rebuild a single service
docker compose up -d --build backend

# Check API health
curl http://localhost:8010/health | python -m json.tool
```

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL async connection string |
| `REDIS_URL` | — | Redis connection string |
| `JWT_SECRET_KEY` | — | Secret for JWT signing |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token TTL |
| `AI_PROVIDER` | `openai` | AI provider (openai/anthropic/grok or any OpenAI-compatible) |
| `AI_API_KEY` | — | API key for the active AI provider |
| `AI_BASE_URL` | Provider-specific | Base URL for AI API (override for self-hosted or alternatives) |
| `AI_MODEL` | Provider-specific | Model name to use (e.g., gpt-4, claude-3-opus, grok-2) |
| `MINIO_ENDPOINT` | `minio:9000` | MinIO server |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `ONLYOFFICE_URL` | `http://onlyoffice` | ONLYOFFICE server URL |
| `ONLYOFFICE_JWT_SECRET` | — | ONLYOFFICE JWT token secret |
| `JITSI_URL` | `http://jitsi-web:80` | Jitsi server URL |
| `STALWART_DOMAIN` | `urban.local` | Mail domain |
| `CORS_ORIGINS` | `http://localhost:3010` | Allowed CORS origins |
| `DEBUG` | `true` | Debug mode flag |
| `FIRST_SUPERADMIN_EMAIL` | — | Initial admin email |
| `FIRST_SUPERADMIN_PASSWORD` | — | Initial admin password |
