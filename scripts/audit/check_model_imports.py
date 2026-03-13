#!/usr/bin/env python3
"""Check that every model .py file in backend/app/models/ is imported in __init__.py."""
import sys
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parents[2] / "backend" / "app" / "models"
SKIP = {"__init__.py", "__pycache__", "base.py"}


def main() -> int:
    init_content = (MODELS_DIR / "__init__.py").read_text()
    model_files = sorted(f.stem for f in MODELS_DIR.glob("*.py") if f.name not in SKIP)

    missing = []
    for mod in model_files:
        pattern = f"from app.models.{mod} import"
        if pattern not in init_content:
            missing.append(mod)

    if missing:
        print(f"FAIL: {len(missing)} model file(s) not imported in __init__.py:")
        for m in missing:
            print(f"  - {m}.py")
        return 1

    print(f"OK: All {len(model_files)} model files are imported in __init__.py.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
