#!/usr/bin/env python3
"""Check that every router .py file in backend/app/api/v1/ is registered in __init__.py."""
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[2] / "backend" / "app" / "api" / "v1"
SKIP = {"__init__.py", "__pycache__"}


def main() -> int:
    init_content = (API_DIR / "__init__.py").read_text()
    router_files = sorted(f.stem for f in API_DIR.glob("*.py") if f.name not in SKIP)

    missing = []
    for mod in router_files:
        # Check for import or include_router reference
        if mod not in init_content:
            missing.append(mod)

    if missing:
        print(f"FAIL: {len(missing)} router file(s) not registered in api/v1/__init__.py:")
        for m in missing:
            print(f"  - {m}.py")
        return 1

    print(f"OK: All {len(router_files)} router files are registered.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
