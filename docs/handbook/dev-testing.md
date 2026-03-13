---
title: Testing Guide
slug: dev-testing
category: development
article_type: guide
module: admin
tags: [testing, pytest, vitest, backend, frontend, ci]
sort_order: 2
is_pinned: false
excerpt: Run backend and frontend tests, write new tests, and understand Urban ERP's testing patterns.
---

# Testing Guide

## Test Stack

| Layer | Framework |
|-------|-----------|
| Backend | pytest + pytest-asyncio (async auto mode) + SQLAlchemy test DB |
| Frontend | Vitest + React Testing Library |

## Running Tests

### Backend

```bash
# All tests with coverage
docker compose exec backend pytest

# Single file
docker compose exec backend pytest tests/test_finance.py -v

# Single test
docker compose exec backend pytest tests/test_finance.py::test_create_invoice -v

# Coverage report with uncovered lines
docker compose exec backend pytest --cov=app --cov-report=term-missing
```

### Frontend

```bash
cd frontend
npx vitest run --reporter=default

# Watch mode (re-runs on file save)
npx vitest --reporter=default
```

## Backend Test Patterns

All fixtures are in `tests/conftest.py`:

- `test_client` — async FastAPI test client with authenticated session
- `db_session` — async SQLAlchemy session connected to the test database (isolated per test)
- `admin_user`, `regular_user` — pre-created user fixtures with JWT tokens

Example test:

```python
async def test_create_invoice(test_client, regular_user):
    response = await test_client.post(
        "/api/v1/finance/invoices",
        json={"contact_id": "...", "line_items": [...]},
        headers={"Authorization": f"Bearer {regular_user.token}"},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "draft"
```

## Frontend Test Patterns

- **Hooks:** use `renderHook` from React Testing Library
- **Components:** use `render` + `userEvent` for interaction
- **API mocks:** use `vi.mock('../../api/finance')` to mock API calls

Example component test:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvoiceForm from './InvoiceForm'

test('submits invoice with correct data', async () => {
  render(<InvoiceForm />)
  await userEvent.type(screen.getByLabelText('Amount'), '50000')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.getByText('Invoice created')).toBeInTheDocument()
})
```

## What to Test

For every new endpoint, write at minimum:
1. **Happy path** — valid request returns expected response
2. **Auth failure** — unauthenticated request returns 401
3. **Validation error** — invalid input returns 422 with helpful message
4. **Not found** — request for non-existent resource returns 404

## CI Integration

GitHub Actions runs all tests on every push and PR. A failing test blocks merge. See `.github/workflows/ci.yml` for the full pipeline.

> **Tip:** Write tests immediately after writing the endpoint, while the expected behaviour is fresh in your mind. Tests catch regressions months after you've forgotten why the logic is written the way it is.
