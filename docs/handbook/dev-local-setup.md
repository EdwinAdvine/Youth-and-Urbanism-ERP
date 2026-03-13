---
title: "Local Development Setup"
slug: "local-development-setup"
category: "development"
article_type: "guide"
tags: [development, local, setup, contributing]
sort_order: 0
is_pinned: true
excerpt: "Set up a local Urban Vibes Dynamics development environment outside Docker."
---

# Local Development Setup

For active development, run the backend and frontend outside Docker with hot-reload, while keeping infrastructure (PostgreSQL, Redis, MinIO, Ollama) in Docker.

## Step 1: Start Infrastructure

```bash
docker compose up -d postgres redis minio ollama
```

## Step 2: Backend Setup

```bash
cd backend

# Create and activate virtualenv
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment (uses Docker infrastructure ports)
cp .env.example .env
# Edit .env: set DATABASE_URL to use port 5433, REDIS_URL to port 6380

# Apply migrations
alembic upgrade head

# Start the dev server with hot reload
uvicorn app.main:app --reload --port 8000
```

Backend available at: `http://localhost:8000`
Swagger docs: `http://localhost:8000/docs`

## Step 3: Frontend Setup

```bash
cd frontend

npm install

# Start Vite dev server
npm run dev
```

Frontend available at: `http://localhost:3010`

The Vite dev server proxies `/api/` → `http://localhost:8000` automatically.

## Running Tests

```bash
# Backend tests (pytest with async support)
cd backend
pytest

# Run a single test file
pytest tests/test_finance.py

# Frontend tests (Vitest)
cd frontend
npx vitest run
```

## Code Quality

```bash
# Backend lint + format
ruff check backend/
ruff format backend/

# Frontend type check
cd frontend && npx tsc --noEmit
```

## Adding a New Module

1. Create model: `backend/app/models/newmodule.py`
2. Create router: `backend/app/api/v1/newmodule.py`
3. Register router in `backend/app/api/v1/__init__.py`
4. Generate migration: `alembic revision --autogenerate -m "add_newmodule"`
5. Apply: `alembic upgrade head`
6. Create API client: `frontend/src/api/newmodule.ts`
7. Create page: `frontend/src/features/newmodule/`
8. Add route in `frontend/src/App.tsx`
9. Add sidebar menu entry in `frontend/src/components/layout/sidebarMenus.tsx`
