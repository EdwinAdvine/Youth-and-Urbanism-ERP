#!/usr/bin/env python3
"""Run all parity audit checks and report results."""
import importlib
import sys
from pathlib import Path

CHECKS = [
    ("check_alembic_dupes", "No duplicate Alembic revision IDs"),
    ("check_model_imports", "All model files imported in __init__.py"),
    ("check_router_registration", "All router files registered"),
    ("check_sidebar_routes", "Sidebar items have matching routes"),
    ("check_future_annotations", "No forbidden 'from __future__' in routers"),
]


def main() -> int:
    # Add this directory to path so we can import checks
    sys.path.insert(0, str(Path(__file__).parent))

    passed = 0
    failed = 0
    errors = 0

    print("=" * 60)
    print("Urban Vibes Dynamics — Parity Audit")
    print("=" * 60)

    for module_name, description in CHECKS:
        print(f"\n--- {description} ---")
        try:
            mod = importlib.import_module(module_name)
            result = mod.main()
            if result == 0:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"ERROR: {e}")
            errors += 1

    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed, {errors} errors")
    print("=" * 60)

    return 0 if (failed == 0 and errors == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
