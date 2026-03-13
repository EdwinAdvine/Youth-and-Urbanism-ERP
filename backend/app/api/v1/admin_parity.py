"""Admin parity dashboard — Super Admin only.

Provides a real-time snapshot of model-router-frontend parity:

    GET /api/v1/admin/parity

Returns counts and gap details for:
  - Model files vs imported models
  - Router files vs registered routers
  - Alembic revision uniqueness
  - from __future__ usage in routers
"""

import os
import re
from pathlib import Path

from fastapi import APIRouter

from app.core.deps import SuperAdminUser

router = APIRouter()

# Resolve paths relative to this file
_BACKEND = Path(__file__).resolve().parents[3]  # backend/
_MODELS_DIR = _BACKEND / "app" / "models"
_ROUTERS_DIR = _BACKEND / "app" / "api" / "v1"
_ALEMBIC_DIR = _BACKEND / "alembic" / "versions"


def _model_check() -> dict:
    """Check that every model .py file is imported in __init__.py."""
    init_path = _MODELS_DIR / "__init__.py"
    init_text = init_path.read_text() if init_path.exists() else ""

    model_files = sorted(
        f.stem
        for f in _MODELS_DIR.glob("*.py")
        if f.stem != "__init__" and not f.stem.startswith("_")
    )

    imported = []
    missing = []
    for name in model_files:
        if f"from app.models.{name} import" in init_text or f"from app.models.{name}" in init_text:
            imported.append(name)
        else:
            missing.append(name)

    return {
        "total_model_files": len(model_files),
        "imported": len(imported),
        "missing_files": missing,
        "pass": len(missing) == 0,
    }


def _router_check() -> dict:
    """Check that every router .py file is registered in __init__.py."""
    init_path = _ROUTERS_DIR / "__init__.py"
    init_text = init_path.read_text() if init_path.exists() else ""

    router_files = sorted(
        f.stem
        for f in _ROUTERS_DIR.glob("*.py")
        if f.stem != "__init__" and not f.stem.startswith("_")
    )

    registered = []
    missing = []
    for name in router_files:
        if name in init_text:
            registered.append(name)
        else:
            missing.append(name)

    return {
        "total_router_files": len(router_files),
        "registered": len(registered),
        "missing_files": missing,
        "pass": len(missing) == 0,
    }


def _alembic_check() -> dict:
    """Check for duplicate Alembic revision IDs."""
    if not _ALEMBIC_DIR.exists():
        return {"total_revisions": 0, "duplicates": [], "pass": True}

    revision_re = re.compile(r'^revision\s*[:=]\s*["\']([a-f0-9]+)["\']', re.MULTILINE)
    seen: dict[str, list[str]] = {}

    for f in sorted(_ALEMBIC_DIR.glob("*.py")):
        text = f.read_text()
        m = revision_re.search(text)
        if m:
            rev_id = m.group(1)
            seen.setdefault(rev_id, []).append(f.name)

    duplicates = [
        {"revision": rev_id, "files": files}
        for rev_id, files in seen.items()
        if len(files) > 1
    ]

    return {
        "total_revisions": len(seen),
        "duplicates": duplicates,
        "pass": len(duplicates) == 0,
    }


def _future_annotations_check() -> dict:
    """Check for forbidden future-annotations import in router files."""
    _FORBIDDEN = "from __future__" + " import annotations"
    violations = []
    for f in sorted(_ROUTERS_DIR.glob("*.py")):
        if f.stem == "__init__":
            continue
        text = f.read_text()
        if _FORBIDDEN in text:
            violations.append(f.stem)

    return {
        "violations": violations,
        "pass": len(violations) == 0,
    }


@router.get("", summary="System parity dashboard (Super Admin)")
async def parity_dashboard(current_user: SuperAdminUser) -> dict:
    """Return full parity audit results."""
    models = _model_check()
    routers = _router_check()
    alembic = _alembic_check()
    future = _future_annotations_check()

    all_pass = all([models["pass"], routers["pass"], alembic["pass"], future["pass"]])

    return {
        "all_pass": all_pass,
        "checks": {
            "model_registration": models,
            "router_registration": routers,
            "alembic_revisions": alembic,
            "future_annotations": future,
        },
    }
