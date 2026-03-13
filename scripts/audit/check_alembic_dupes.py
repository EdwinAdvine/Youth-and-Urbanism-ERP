#!/usr/bin/env python3
"""Check for duplicate Alembic revision IDs across migration files."""
import re
import sys
from collections import Counter
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parents[2] / "backend" / "alembic" / "versions"


def main() -> int:
    revisions: list[tuple[str, str]] = []
    for f in sorted(VERSIONS_DIR.glob("*.py")):
        if f.name == "__pycache__":
            continue
        content = f.read_text()
        m = re.search(r"^revision(?:\s*:\s*str)?\s*=\s*['\"]([^'\"]+)['\"]", content, re.MULTILINE)
        if m:
            revisions.append((m.group(1), f.name))

    counts = Counter(rev for rev, _ in revisions)
    dupes = {rev: count for rev, count in counts.items() if count > 1}

    if dupes:
        print("FAIL: Duplicate Alembic revision IDs found:")
        for rev, count in dupes.items():
            files = [name for r, name in revisions if r == rev]
            print(f"  {rev} ({count}x): {', '.join(files)}")
        return 1

    print(f"OK: {len(revisions)} unique revision IDs, no duplicates.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
