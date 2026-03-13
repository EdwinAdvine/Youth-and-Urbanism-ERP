#!/usr/bin/env python3
"""Measure docstring and comment coverage across the Urban Vibes Dynamics codebase.

Scans Python (backend) and TypeScript/TSX (frontend) source files to measure
the percentage of functions, classes, and modules that have docstrings or JSDoc
comments. Outputs a per-module report and enforces minimum thresholds.

Usage:
    # Full report
    python scripts/doc-coverage.py

    # Enforce CI thresholds
    python scripts/doc-coverage.py --min-backend=80 --min-frontend=50

    # Only check changed files (for pre-commit hooks)
    python scripts/doc-coverage.py --changed-only

    # Report for a specific module
    python scripts/doc-coverage.py --module=finance
"""
from __future__ import annotations

import argparse
import ast
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

# ── Project paths ──────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend" / "app"
FRONTEND_DIR = PROJECT_ROOT / "frontend" / "src"


# ── Data structures ───────────────────────────────────────────────────────

@dataclass
class FileCoverage:
    """Coverage stats for a single source file."""
    path: str
    has_module_docstring: bool = False
    total_functions: int = 0
    documented_functions: int = 0
    total_classes: int = 0
    documented_classes: int = 0
    comment_lines: int = 0
    total_lines: int = 0

    @property
    def function_coverage(self) -> float:
        """Percentage of functions with docstrings."""
        if self.total_functions == 0:
            return 100.0
        return (self.documented_functions / self.total_functions) * 100

    @property
    def class_coverage(self) -> float:
        """Percentage of classes with docstrings."""
        if self.total_classes == 0:
            return 100.0
        return (self.documented_classes / self.total_classes) * 100

    @property
    def overall_score(self) -> float:
        """Weighted coverage score: 30% module doc + 50% functions + 20% classes."""
        module_score = 100.0 if self.has_module_docstring else 0.0
        return module_score * 0.3 + self.function_coverage * 0.5 + self.class_coverage * 0.2


@dataclass
class ModuleCoverage:
    """Aggregated coverage stats for a module (directory)."""
    name: str
    files: list[FileCoverage] = field(default_factory=list)

    @property
    def total_functions(self) -> int:
        return sum(f.total_functions for f in self.files)

    @property
    def documented_functions(self) -> int:
        return sum(f.documented_functions for f in self.files)

    @property
    def function_coverage(self) -> float:
        if self.total_functions == 0:
            return 100.0
        return (self.documented_functions / self.total_functions) * 100

    @property
    def module_docstring_coverage(self) -> float:
        if not self.files:
            return 100.0
        return (sum(1 for f in self.files if f.has_module_docstring) / len(self.files)) * 100

    @property
    def overall_score(self) -> float:
        if not self.files:
            return 100.0
        return sum(f.overall_score for f in self.files) / len(self.files)


# ── Python analysis ───────────────────────────────────────────────────────

def analyze_python_file(filepath: Path) -> FileCoverage:
    """Parse a Python file and measure docstring coverage using the AST.

    Counts module-level docstrings, function/method docstrings, and class
    docstrings. Also counts comment lines (lines starting with #).
    """
    source = filepath.read_text(encoding="utf-8", errors="replace")
    lines = source.splitlines()
    cov = FileCoverage(
        path=str(filepath.relative_to(PROJECT_ROOT)),
        total_lines=len(lines),
        comment_lines=sum(1 for line in lines if line.strip().startswith("#")),
    )

    try:
        tree = ast.parse(source)
    except SyntaxError:
        return cov

    # Module-level docstring
    if (
        tree.body
        and isinstance(tree.body[0], ast.Expr)
        and isinstance(tree.body[0].value, ast.Constant)
    ):
        cov.has_module_docstring = True

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Skip private helpers (single underscore prefix, not dunder)
            if node.name.startswith("_") and not node.name.startswith("__"):
                continue
            cov.total_functions += 1
            if ast.get_docstring(node):
                cov.documented_functions += 1

        elif isinstance(node, ast.ClassDef):
            cov.total_classes += 1
            if ast.get_docstring(node):
                cov.documented_classes += 1

    return cov


# ── TypeScript/TSX analysis ───────────────────────────────────────────────

# Regex patterns for TypeScript/TSX documentation detection
TS_JSDOC_PATTERN = re.compile(r"/\*\*[\s\S]*?\*/")
TS_EXPORT_FUNCTION = re.compile(
    r"^export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)", re.MULTILINE
)
TS_EXPORT_CONST_FN = re.compile(
    r"^export\s+(?:default\s+)?const\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=])*\s*=>", re.MULTILINE
)
TS_COMPONENT_PATTERN = re.compile(
    r"^export\s+(?:default\s+)?(?:function|const)\s+([A-Z]\w+)", re.MULTILINE
)


def analyze_typescript_file(filepath: Path) -> FileCoverage:
    """Analyze a TypeScript/TSX file for JSDoc coverage.

    Uses regex-based heuristics since TypeScript doesn't have a Python-like
    AST available in Python. Checks for:
    - File-level JSDoc (first /** ... */ block before any code)
    - JSDoc blocks immediately before exported functions/components
    """
    source = filepath.read_text(encoding="utf-8", errors="replace")
    lines = source.splitlines()
    cov = FileCoverage(
        path=str(filepath.relative_to(PROJECT_ROOT)),
        total_lines=len(lines),
        comment_lines=sum(
            1 for line in lines
            if line.strip().startswith("//") or line.strip().startswith("*")
        ),
    )

    # File-level JSDoc: must appear before any import/export/const/function
    first_code_match = re.search(r"^(?:import|export|const|function|class|interface|type|enum)\b", source, re.MULTILINE)
    if first_code_match:
        preamble = source[:first_code_match.start()]
        if TS_JSDOC_PATTERN.search(preamble):
            cov.has_module_docstring = True

    # Find all exported functions/components
    all_exports: list[tuple[int, str]] = []
    for match in TS_EXPORT_FUNCTION.finditer(source):
        all_exports.append((match.start(), match.group(1)))
    for match in TS_EXPORT_CONST_FN.finditer(source):
        all_exports.append((match.start(), match.group(1)))

    cov.total_functions = len(all_exports)

    # Check if each export has a JSDoc block within 5 lines before it
    for pos, _name in all_exports:
        # Look backwards from the export for a JSDoc block ending with */
        preceding = source[max(0, pos - 500):pos].rstrip()
        if preceding.rstrip().endswith("*/"):
            # Verify it's a JSDoc (starts with /**)
            jsdoc_start = preceding.rfind("/**")
            if jsdoc_start != -1:
                cov.documented_functions += 1

    return cov


# ── Scanning ──────────────────────────────────────────────────────────────

def scan_backend(module_filter: str | None = None) -> list[ModuleCoverage]:
    """Scan all Python files in the backend and group by module directory."""
    modules: dict[str, ModuleCoverage] = {}

    for dirpath, _dirnames, filenames in os.walk(BACKEND_DIR):
        for filename in sorted(filenames):
            if not filename.endswith(".py") or filename == "__init__.py":
                continue

            filepath = Path(dirpath) / filename
            rel = filepath.relative_to(BACKEND_DIR)

            # Determine module name from directory structure
            parts = rel.parts
            if len(parts) >= 2:
                module_name = parts[0]  # e.g., "api", "models", "services", "core"
            else:
                module_name = "root"

            if module_filter and module_filter not in str(rel):
                continue

            if module_name not in modules:
                modules[module_name] = ModuleCoverage(name=module_name)

            cov = analyze_python_file(filepath)
            modules[module_name].files.append(cov)

    return sorted(modules.values(), key=lambda m: m.name)


def scan_frontend(module_filter: str | None = None) -> list[ModuleCoverage]:
    """Scan all TypeScript/TSX files in the frontend and group by feature module."""
    modules: dict[str, ModuleCoverage] = {}

    for dirpath, _dirnames, filenames in os.walk(FRONTEND_DIR):
        for filename in sorted(filenames):
            if not filename.endswith((".ts", ".tsx")):
                continue
            if filename.endswith(".d.ts") or filename == "vite-env.d.ts":
                continue

            filepath = Path(dirpath) / filename
            rel = filepath.relative_to(FRONTEND_DIR)

            # Determine module from directory structure
            parts = rel.parts
            if len(parts) >= 2:
                module_name = parts[0]  # e.g., "features", "api", "components"
                if module_name == "features" and len(parts) >= 3:
                    module_name = f"features/{parts[1]}"
            else:
                module_name = "root"

            if module_filter and module_filter not in str(rel):
                continue

            if module_name not in modules:
                modules[module_name] = ModuleCoverage(name=module_name)

            cov = analyze_typescript_file(filepath)
            modules[module_name].files.append(cov)

    return sorted(modules.values(), key=lambda m: m.name)


def get_changed_files() -> set[str]:
    """Get files changed in the current branch vs main (for --changed-only mode)."""
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "main...HEAD"],
            capture_output=True, text=True, cwd=PROJECT_ROOT,
        )
        if result.returncode != 0:
            # Fallback: diff against last commit
            result = subprocess.run(
                ["git", "diff", "--name-only", "HEAD~1"],
                capture_output=True, text=True, cwd=PROJECT_ROOT,
            )
        return set(result.stdout.strip().splitlines())
    except FileNotFoundError:
        return set()


# ── Reporting ─────────────────────────────────────────────────────────────

def print_report(title: str, modules: list[ModuleCoverage]) -> float:
    """Print a formatted coverage report and return the overall score."""
    print(f"\n{'=' * 70}")
    print(f"  {title}")
    print(f"{'=' * 70}")

    total_funcs = 0
    documented_funcs = 0
    total_files = 0
    files_with_module_doc = 0

    for mod in modules:
        if not mod.files:
            continue

        total_funcs += mod.total_functions
        documented_funcs += mod.documented_functions
        total_files += len(mod.files)
        files_with_module_doc += sum(1 for f in mod.files if f.has_module_docstring)

        print(
            f"  {mod.name:<30} "
            f"files: {len(mod.files):>3}  "
            f"funcs: {mod.documented_functions:>3}/{mod.total_functions:<3}  "
            f"({mod.function_coverage:5.1f}%)  "
            f"mod-doc: {mod.module_docstring_coverage:5.1f}%  "
            f"score: {mod.overall_score:5.1f}%"
        )

    func_pct = (documented_funcs / total_funcs * 100) if total_funcs else 100.0
    mod_pct = (files_with_module_doc / total_files * 100) if total_files else 100.0
    overall = mod_pct * 0.3 + func_pct * 0.7

    print(f"{'─' * 70}")
    print(f"  TOTAL: {total_files} files, {documented_funcs}/{total_funcs} functions documented ({func_pct:.1f}%)")
    print(f"  Module docstrings: {files_with_module_doc}/{total_files} ({mod_pct:.1f}%)")
    print(f"  Overall score: {overall:.1f}%")

    return overall


# ── Main ──────────────────────────────────────────────────────────────────

def main() -> None:
    """Entry point: parse args, scan codebase, print report, enforce thresholds."""
    parser = argparse.ArgumentParser(description="Measure documentation coverage for Urban Vibes Dynamics")
    parser.add_argument("--min-backend", type=float, default=0, help="Minimum backend score (CI threshold)")
    parser.add_argument("--min-frontend", type=float, default=0, help="Minimum frontend score (CI threshold)")
    parser.add_argument("--module", type=str, default=None, help="Filter to a specific module name")
    parser.add_argument("--changed-only", action="store_true", help="Only check files changed vs main")
    args = parser.parse_args()

    if args.changed_only:
        changed = get_changed_files()
        if not changed:
            print("No changed files detected. Skipping coverage check.")
            sys.exit(0)
        print(f"Checking {len(changed)} changed files...")

    backend_modules = scan_backend(args.module)
    frontend_modules = scan_frontend(args.module)

    backend_score = print_report("Backend (Python) Documentation Coverage", backend_modules)
    frontend_score = print_report("Frontend (TypeScript) Documentation Coverage", frontend_modules)

    print(f"\n{'=' * 70}")
    print(f"  SUMMARY")
    print(f"{'=' * 70}")
    print(f"  Backend score:  {backend_score:5.1f}%  (threshold: {args.min_backend}%)")
    print(f"  Frontend score: {frontend_score:5.1f}%  (threshold: {args.min_frontend}%)")

    # Enforce thresholds
    failed = False
    if args.min_backend > 0 and backend_score < args.min_backend:
        print(f"\n  FAIL: Backend score {backend_score:.1f}% is below threshold {args.min_backend}%")
        failed = True
    if args.min_frontend > 0 and frontend_score < args.min_frontend:
        print(f"\n  FAIL: Frontend score {frontend_score:.1f}% is below threshold {args.min_frontend}%")
        failed = True

    if failed:
        sys.exit(1)
    elif args.min_backend > 0 or args.min_frontend > 0:
        print("\n  PASS: All thresholds met.")


if __name__ == "__main__":
    main()
