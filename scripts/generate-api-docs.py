#!/usr/bin/env python3
"""Auto-generate API reference documentation from FastAPI router files.

Parses all Python router files in backend/app/api/v1/ to extract endpoint
signatures, docstrings, HTTP methods, paths, and dependencies. Generates
per-module Markdown files in docs/api/.

Usage:
    python scripts/generate-api-docs.py

    # Generate for a single module
    python scripts/generate-api-docs.py --module=finance

    # Dry run (print to stdout, don't write files)
    python scripts/generate-api-docs.py --dry-run
"""
from __future__ import annotations

import argparse
import ast
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

# ── Project paths ──────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ROUTERS_DIR = PROJECT_ROOT / "backend" / "app" / "api" / "v1"
OUTPUT_DIR = PROJECT_ROOT / "docs" / "api"

# ── Module grouping ───────────────────────────────────────────────────────
# Maps router filename prefixes to module names for grouping

MODULE_MAP: dict[str, str] = {
    "finance": "Finance",
    "crm": "CRM",
    "calendar": "Calendar & Meetings",
    "hr": "HR & Payroll",
    "payroll": "HR & Payroll",
    "support": "Support & Help Desk",
    "ai": "AI System",
    "agent": "AI System",
    "ecommerce": "E-Commerce",
    "projects": "Projects",
    "inventory": "Inventory",
    "manufacturing": "Manufacturing",
    "supplychain": "Supply Chain",
    "mail": "Communication",
    "chat": "Communication",
    "drive": "Drive & Documents",
    "docs": "Drive & Documents",
    "notes": "Notes",
    "notebooks": "Notes",
    "note_databases": "Notes",
    "pos": "Point of Sale",
    "kds": "Point of Sale",
    "loyalty": "Point of Sale",
    "forms": "Forms",
    "analytics": "Analytics",
    "admin": "Admin",
    "users": "Admin",
    "roles": "Admin",
    "app_admin": "Admin",
    "user_import": "Admin",
    "auth": "Authentication",
    "sso": "Authentication",
    "license": "Admin",
    "settings": "Settings",
    "profile": "User Profile",
    "notifications": "Notifications",
    "backups": "Admin",
    "booking": "Booking",
    "collab": "Collaboration",
    "cross_module": "Cross-Module",
    "dashboard": "Dashboard",
    "search": "Search",
    "storefront": "E-Commerce",
    "handbook": "Handbook",
    "meetings": "Calendar & Meetings",
}


@dataclass
class EndpointInfo:
    """Parsed information about a single API endpoint."""
    method: str          # GET, POST, PUT, PATCH, DELETE
    path: str            # Route path (e.g., "/invoices/{id}")
    function_name: str   # Python function name
    docstring: str       # Function docstring (may be empty)
    params: list[str]    # Parameter names
    response_model: str  # Response model name if specified
    dependencies: list[str]  # Dependency names (CurrentUser, etc.)
    line_number: int     # Line in source file


@dataclass
class RouterInfo:
    """Parsed information about a router file."""
    filename: str
    module_name: str
    module_docstring: str
    prefix: str
    endpoints: list[EndpointInfo] = field(default_factory=list)


# ── HTTP method decorators ─────────────────────────────────────────────────

HTTP_METHODS = {"get", "post", "put", "patch", "delete"}


def get_module_name(filename: str) -> str:
    """Determine the module group for a router filename.

    Matches filename prefixes against MODULE_MAP. Falls back to
    capitalizing the filename stem if no prefix matches.
    """
    stem = filename.replace(".py", "")

    # Direct match
    if stem in MODULE_MAP:
        return MODULE_MAP[stem]

    # Prefix match (e.g., "finance_ext" → "Finance")
    for prefix, module in MODULE_MAP.items():
        if stem.startswith(prefix):
            return module

    return stem.replace("_", " ").title()


def parse_router_file(filepath: Path) -> RouterInfo | None:
    """Parse a FastAPI router file and extract endpoint information.

    Uses the Python AST to find:
    - Module-level docstring
    - Router prefix (from APIRouter instantiation)
    - All endpoint functions (decorated with @router.get/post/etc.)
    """
    source = filepath.read_text(encoding="utf-8", errors="replace")

    try:
        tree = ast.parse(source)
    except SyntaxError:
        return None

    filename = filepath.name
    module_docstring = ast.get_docstring(tree) or ""
    module_name = get_module_name(filename)

    info = RouterInfo(
        filename=filename,
        module_name=module_name,
        module_docstring=module_docstring,
        prefix="",
    )

    # Find router prefix from APIRouter(..., prefix="/...")
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "router":
                    if isinstance(node.value, ast.Call):
                        for kw in node.value.keywords:
                            if kw.arg == "prefix" and isinstance(kw.value, ast.Constant):
                                info.prefix = kw.value.value

    # Find all endpoint functions
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue

        # Check if decorated with @router.<method>(...)
        for decorator in node.decorator_list:
            method = None
            path = ""
            response_model = ""

            if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute):
                attr = decorator.func
                if isinstance(attr.value, ast.Name) and attr.attr in HTTP_METHODS:
                    method = attr.attr.upper()

                    # Extract path from first positional arg
                    if decorator.args and isinstance(decorator.args[0], ast.Constant):
                        path = decorator.args[0].value

                    # Extract response_model keyword
                    for kw in decorator.keywords:
                        if kw.arg == "response_model" and isinstance(kw.value, ast.Name):
                            response_model = kw.value.id

            elif isinstance(decorator, ast.Attribute):
                if isinstance(decorator.value, ast.Name) and decorator.attr in HTTP_METHODS:
                    method = decorator.attr.upper()

            if method is None:
                continue

            # Extract parameter names (skip self, db, current_user for brevity)
            params = []
            deps = []
            for arg in node.args.args:
                name = arg.arg
                if name in ("self",):
                    continue
                # Check annotation for dependency types
                if arg.annotation:
                    ann = ast.dump(arg.annotation)
                    if "CurrentUser" in ann or "SuperAdminUser" in ann:
                        deps.append(name)
                        continue
                    if "DBSession" in ann or "AsyncSession" in ann:
                        continue
                params.append(name)

            endpoint = EndpointInfo(
                method=method,
                path=path,
                function_name=node.name,
                docstring=ast.get_docstring(node) or "",
                params=params,
                response_model=response_model,
                dependencies=deps,
                line_number=node.lineno,
            )
            info.endpoints.append(endpoint)
            break  # Only process first matching decorator per function

    if not info.endpoints:
        return None

    return info


def generate_module_markdown(module_name: str, routers: list[RouterInfo]) -> str:
    """Generate a Markdown document for a module's API endpoints.

    Groups endpoints by router file, shows HTTP method, path, description,
    and parameter information.
    """
    lines: list[str] = []
    lines.append(f"# {module_name} — API Reference\n")
    lines.append(f"> Auto-generated from FastAPI router files. Do not edit manually.\n")
    lines.append(f"> Re-generate with: `python scripts/generate-api-docs.py`\n")
    lines.append("")

    total_endpoints = sum(len(r.endpoints) for r in routers)
    lines.append(f"**Total endpoints:** {total_endpoints}\n")
    lines.append("")

    # Table of contents
    lines.append("## Contents\n")
    for router in routers:
        anchor = router.filename.replace(".py", "").replace("_", "-")
        lines.append(f"- [{router.filename}](#{anchor}) ({len(router.endpoints)} endpoints)")
    lines.append("")

    # Per-router sections
    for router in routers:
        lines.append(f"---\n")
        anchor = router.filename.replace(".py", "").replace("_", "-")
        lines.append(f"## {router.filename}\n")

        if router.module_docstring:
            lines.append(f"{router.module_docstring}\n")

        if router.prefix:
            lines.append(f"**Base path:** `{router.prefix}`\n")
        lines.append("")

        # Endpoint table
        lines.append("| Method | Path | Function | Description |")
        lines.append("|--------|------|----------|-------------|")

        for ep in router.endpoints:
            full_path = f"{router.prefix}{ep.path}" if router.prefix else ep.path
            desc = ep.docstring.split("\n")[0] if ep.docstring else "—"
            # Truncate long descriptions
            if len(desc) > 80:
                desc = desc[:77] + "..."
            lines.append(f"| `{ep.method}` | `{full_path}` | `{ep.function_name}` | {desc} |")

        lines.append("")

        # Detailed endpoint docs
        for ep in router.endpoints:
            full_path = f"{router.prefix}{ep.path}" if router.prefix else ep.path
            lines.append(f"### `{ep.method} {full_path}`\n")
            lines.append(f"**Function:** `{ep.function_name}` (line {ep.line_number})\n")

            if ep.docstring:
                lines.append(f"{ep.docstring}\n")

            if ep.params:
                lines.append(f"**Parameters:** `{'`, `'.join(ep.params)}`\n")
            if ep.response_model:
                lines.append(f"**Response model:** `{ep.response_model}`\n")
            if ep.dependencies:
                lines.append(f"**Auth:** `{'`, `'.join(ep.dependencies)}`\n")

            lines.append("")

    return "\n".join(lines)


def main() -> None:
    """Entry point: parse all routers, group by module, generate Markdown files."""
    parser = argparse.ArgumentParser(description="Generate API reference docs from FastAPI routers")
    parser.add_argument("--module", type=str, default=None, help="Generate for a specific module only")
    parser.add_argument("--dry-run", action="store_true", help="Print to stdout instead of writing files")
    args = parser.parse_args()

    # Parse all router files
    routers_by_module: dict[str, list[RouterInfo]] = defaultdict(list)

    for filepath in sorted(ROUTERS_DIR.glob("*.py")):
        if filepath.name == "__init__.py":
            continue

        router_info = parse_router_file(filepath)
        if router_info is None:
            continue

        if args.module and args.module.lower() not in router_info.module_name.lower():
            continue

        routers_by_module[router_info.module_name].append(router_info)

    if not routers_by_module:
        print("No routers found.")
        sys.exit(1)

    # Create output directory
    if not args.dry_run:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Generate docs per module
    for module_name, routers in sorted(routers_by_module.items()):
        markdown = generate_module_markdown(module_name, routers)

        if args.dry_run:
            print(markdown)
            print("\n" + "=" * 70 + "\n")
        else:
            # Create filename from module name
            slug = module_name.lower().replace(" & ", "-").replace(" ", "-")
            output_path = OUTPUT_DIR / f"{slug}-api.md"
            output_path.write_text(markdown, encoding="utf-8")
            print(f"  Generated: {output_path.relative_to(PROJECT_ROOT)} ({len(routers)} routers, {sum(len(r.endpoints) for r in routers)} endpoints)")

    print(f"\nDone. Generated API docs for {len(routers_by_module)} modules.")


if __name__ == "__main__":
    main()
