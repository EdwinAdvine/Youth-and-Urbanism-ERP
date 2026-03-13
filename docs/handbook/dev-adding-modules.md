---
title: Adding a New Module
slug: dev-adding-modules
category: development
article_type: guide
module: admin
tags: [development, modules, backend, frontend, routing, migration]
sort_order: 3
is_pinned: false
excerpt: Step-by-step guide to building a new module from database model to UI page.
---

# Adding a New Module

Follow these 9 steps in order. Run the parity audit after steps 4 and 9 to catch issues early.

## Step 1 — Create the Model

Create `backend/app/models/newmodule.py`:

```python
"""New module SQLAlchemy models."""
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class NewThing(Base):
    __tablename__ = "new_things"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
```

## Step 2 — Register the Model

In `backend/app/models/__init__.py`, add:

```python
from .newmodule import NewThing
__all__ = [..., "NewThing"]
```

This is required for Alembic to detect the model.

## Step 3 — Create the Router

Create `backend/app/api/v1/newmodule.py`:

```python
"""New module API router."""
# Do NOT add: from __future__ import annotations  (breaks FastAPI)
from fastapi import APIRouter
from app.core.deps import CurrentUser, DBSession

router = APIRouter()

@router.get("", summary="List new things")
async def list_things(current_user: CurrentUser, db: DBSession):
    ...
```

## Step 4 — Register the Router

In `backend/app/api/v1/__init__.py`:

```python
from . import newmodule
router.include_router(newmodule.router, prefix="/newmodule", tags=["New Module"])
```

Run parity audit: `python3 scripts/audit/run_all_checks.py`

## Step 5 — Generate the Migration

```bash
docker compose exec backend alembic revision --autogenerate -m "add_newmodule"
```

Review the generated file in `backend/alembic/versions/` before proceeding.

## Step 6 — Apply the Migration

```bash
docker compose exec backend alembic upgrade head
```

## Step 7 — Create the API Client

Create `frontend/src/api/newmodule.ts`:

```typescript
/**
 * New Module API client
 */
import apiClient from './client'
import { useQuery } from '@tanstack/react-query'

export function useNewThings() {
  return useQuery({
    queryKey: ['new-things'],
    queryFn: () => apiClient.get('/newmodule').then(r => r.data),
  })
}
```

## Step 8 — Create the UI Page

Create `frontend/src/features/newmodule/NewmodulePage.tsx` and add the route in `App.tsx`:

```tsx
const NewmodulePage = lazy(() => import('./features/newmodule/NewmodulePage'))
// In the routes:
<Route path="newmodule" element={<S><NewmodulePage /></S>} />
```

## Step 9 — Add to Sidebar

In `frontend/src/components/layout/sidebarMenus.tsx`, add an entry to the appropriate module group.

Run parity audit again: `python3 scripts/audit/run_all_checks.py` — all checks must pass.

## Additional Considerations

- **RBAC** — use `require_app_admin("newmodule")` DI if the module needs scoped admin access
- **Event bus** — register handlers in `backend/app/main.py` lifespan for cross-module reactions
- **AI tools** — add tools to `backend/app/services/ai_tools.py` if Urban Bad AI should interact with this module

> **Tip:** Run the parity audit after step 4 and again after step 9 — catching mismatches early saves debugging time.
