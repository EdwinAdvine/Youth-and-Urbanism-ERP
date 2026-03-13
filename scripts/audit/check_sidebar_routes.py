#!/usr/bin/env python3
"""Check that sidebar menu items have matching routes in App.tsx."""
import re
import sys
from pathlib import Path

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend" / "src"


def main() -> int:
    sidebar_file = FRONTEND_DIR / "components" / "layout" / "sidebarMenus.tsx"
    app_file = FRONTEND_DIR / "App.tsx"

    if not sidebar_file.exists():
        print("SKIP: sidebarMenus.tsx not found.")
        return 0
    if not app_file.exists():
        print("SKIP: App.tsx not found.")
        return 0

    sidebar_content = sidebar_file.read_text()
    app_content = app_file.read_text()

    # Extract paths from sidebar (look for path: "/..." patterns)
    sidebar_paths = set(re.findall(r'path:\s*["\'](/[^"\']+)["\']', sidebar_content))

    # Extract route paths from App.tsx
    route_paths = set(re.findall(r'path=\s*["\']([^"\']+)["\']', app_content))
    # Also catch catch-all routes like /mail/*
    catchall_prefixes = {p.rstrip("/*") for p in route_paths if p.endswith("/*")}

    missing = []
    for sp in sorted(sidebar_paths):
        # Skip exact matches
        if sp in route_paths:
            continue
        # Check if covered by a catch-all route
        if any(sp.startswith(prefix) for prefix in catchall_prefixes):
            continue
        # Check if it's a parameterized route (contains :)
        # Try matching against route patterns
        matched = False
        for rp in route_paths:
            if ":" in rp:
                pattern = re.sub(r":[^/]+", r"[^/]+", rp)
                if re.match(f"^{pattern}$", sp):
                    matched = True
                    break
        if not matched:
            missing.append(sp)

    if missing:
        print(f"WARN: {len(missing)} sidebar path(s) have no matching route in App.tsx:")
        for m in missing:
            print(f"  - {m}")
        return 1

    print(f"OK: All {len(sidebar_paths)} sidebar paths have matching routes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
