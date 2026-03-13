# Database Architecture

Urban Vibes Dynamics uses **PostgreSQL 16** with **SQLAlchemy 2.0 async** (asyncpg driver)
for all database operations. This document covers the connection setup,
async session patterns, migration workflow, and common patterns.

---

## Connection Setup

**File:** `backend/app/core/database.py`

```python
from app.core.database import AsyncSessionLocal, get_db, Base
```

The async engine is configured with:
- **asyncpg driver** — fastest PostgreSQL async driver for Python
- **Connection pool:** `pool_size=10`, `max_overflow=20`
- **Pool pre-ping:** validates connections before use (handles stale connections)
- **echo=False** in production (set `DEBUG=True` to log all SQL)

---

## Session Management

### In FastAPI Endpoints (Dependency Injection)

Use the `DBSession` type alias from `app.core.deps`:

```python
from app.core.deps import DBSession

@router.get("/invoices")
async def list_invoices(db: DBSession):
    result = await db.execute(select(Invoice))
    return result.scalars().all()
```

The session is automatically committed (if no exception) and closed after
the request completes via the `get_db()` async generator.

### In Event Handlers and Background Tasks

Create sessions manually with `AsyncSessionLocal`:

```python
from app.core.database import AsyncSessionLocal

async def handle_event(data: dict):
    async with AsyncSessionLocal() as db:
        # db is committed and closed when the context exits
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        await db.commit()
```

---

## Common Query Patterns

### Fetch single row

```python
result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
invoice = result.scalar_one_or_none()  # None if not found
if not invoice:
    raise HTTPException(404, "Invoice not found")
```

### Fetch list with filters

```python
stmt = (
    select(Invoice)
    .where(Invoice.customer_id == customer_id)
    .where(Invoice.status == "sent")
    .order_by(Invoice.due_date.asc())
    .limit(page_size)
    .offset((page - 1) * page_size)
)
result = await db.execute(stmt)
invoices = result.scalars().all()
```

### Count

```python
from sqlalchemy import func, select

result = await db.execute(
    select(func.count()).select_from(Invoice).where(Invoice.status == "overdue")
)
count = result.scalar()
```

### Create

```python
invoice = Invoice(**payload.model_dump(), owner_id=current_user.id)
db.add(invoice)
await db.flush()   # assign DB-generated id without committing
await db.commit()
await db.refresh(invoice)  # reload from DB (picks up server defaults)
return invoice
```

### Update

```python
await db.execute(
    update(Invoice)
    .where(Invoice.id == invoice_id)
    .values(status="paid", paid_at=datetime.utcnow())
)
await db.commit()
```

### Delete

```python
await db.execute(delete(Invoice).where(Invoice.id == invoice_id))
await db.commit()
```

---

## Models

All SQLAlchemy models live in `backend/app/models/`. Every model inherits
from `Base` (declarative base) and typically also from `TimestampMixin`
(adds `created_at`, `updated_at`) and `UUIDPrimaryKeyMixin` (UUID primary key).

```python
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

class Invoice(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "invoices"
    # ...
```

---

## Migrations (Alembic)

All schema changes MUST go through Alembic migrations.

### Generate a migration

```bash
docker compose exec backend alembic revision --autogenerate -m "add_invoice_currency"
```

Review the generated file in `alembic/versions/` before applying.

### Apply migrations

```bash
docker compose exec backend alembic upgrade head
```

### Check current state

```bash
docker compose exec backend alembic current    # current revision
docker compose exec backend alembic heads      # latest available
docker compose exec backend alembic history    # full history
```

### Roll back one step

```bash
docker compose exec backend alembic downgrade -1
```

> **Never** modify existing migration files that have already been applied
> in any environment. Always create a new migration.

---

## pgvector Extension

PostgreSQL is configured with the **pgvector** extension for vector similarity
search. This powers the AI embedding search in Drive (document search),
Notes (semantic search), and the AI tools.

Migrations that add vector columns use:
```python
from pgvector.sqlalchemy import Vector
embedding = mapped_column(Vector(1536), nullable=True)
```

---

## Connection URL Format

```
postgresql+asyncpg://<user>:<password>@<host>:<port>/<database>
```

Development: `postgresql+asyncpg://urban:urban@localhost:5433/urban_erp`
Docker (internal): `postgresql+asyncpg://urban:urban@postgres:5432/urban_erp`
