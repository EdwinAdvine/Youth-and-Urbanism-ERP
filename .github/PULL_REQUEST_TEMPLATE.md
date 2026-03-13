## Summary

<!-- Brief description of changes -->

## Parity Checklist

Before merging, confirm all seven checks pass:

- [ ] **No duplicate Alembic revision IDs** — `python3 scripts/audit/check_alembic_dupes.py`
- [ ] **All model files imported in `models/__init__.py`** — `python3 scripts/audit/check_model_imports.py`
- [ ] **All imported models listed in `__all__`** — verify manually or via script
- [ ] **All router files registered in `api/v1/__init__.py`** — `python3 scripts/audit/check_router_registration.py`
- [ ] **Sidebar items have matching routes in App.tsx** — `python3 scripts/audit/check_sidebar_routes.py`
- [ ] **No `from __future__ import annotations` in routers** — `python3 scripts/audit/check_future_annotations.py`
- [ ] **Full audit passes** — `python3 scripts/audit/run_all_checks.py` exits 0

## If you added a new module

- [ ] Model file created in `backend/app/models/`
- [ ] Model imported and added to `__all__` in `models/__init__.py`
- [ ] Router created in `backend/app/api/v1/`
- [ ] Router registered in `api/v1/__init__.py`
- [ ] Alembic migration generated and applied
- [ ] API client created in `frontend/src/api/`
- [ ] Page component + route added in `App.tsx`
- [ ] Sidebar entry added (if user-facing)

## Test Plan

- [ ] <!-- describe how this was tested -->
