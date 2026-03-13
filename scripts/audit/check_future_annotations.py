#!/usr/bin/env python3
"""Check that no API router files use 'from __future__ import annotations'.

This import breaks Pydantic 2.x + FastAPI type resolution at runtime.
Python 3.12+ supports X | Y natively, so the import is unnecessary.
"""
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[2] / "backend" / "app" / "api" / "v1"


def main() -> int:
    offenders = []
    for f in sorted(API_DIR.glob("*.py")):
        if f.name == "__init__.py":
            continue
        content = f.read_text()
        if "from __future__ import annotations" in content:
            offenders.append(f.name)

    if offenders:
        print(f"FAIL: {len(offenders)} router file(s) use 'from __future__ import annotations':")
        for name in offenders:
            print(f"  - {name}")
        print("\nThis breaks Pydantic 2.x type resolution. Remove the import.")
        return 1

    print("OK: No router files use 'from __future__ import annotations'.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
