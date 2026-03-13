#!/usr/bin/env python3
"""Validate conventional commit message format.

Used as a commit-msg git hook (via pre-commit) to enforce consistent commit
message style across the Urban Vibes Dynamics codebase.

Expected format:
    type(scope): short description

    Optional longer body...

    Optional footer: BREAKING CHANGE: ..., Closes #123, etc.

Valid types:
    feat      — new feature
    fix       — bug fix
    docs      — documentation only
    refactor  — code change without feature/fix
    test      — tests only
    chore     — tooling, deps, build system
    perf      — performance improvement
    security  — security fix or hardening
    revert    — revert a previous commit

Valid scopes (module names or infrastructure areas):
    finance, crm, hr, calendar, projects, support, ai, ecommerce,
    inventory, manufacturing, supply-chain, pos, mail, drive, notes,
    chat, analytics, forms, booking, auth, admin,
    docker, deps, ci, migrations, core, agent

Usage (called by pre-commit framework):
    python scripts/check-commit-msg.py .git/COMMIT_EDITMSG

Exit codes:
    0 — commit message is valid
    1 — commit message is invalid (prints error + examples)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# ── Valid types and scopes ────────────────────────────────────────────────────

VALID_TYPES: frozenset[str] = frozenset({
    "feat", "fix", "docs", "refactor", "test", "chore",
    "perf", "security", "revert", "wip",
})

VALID_SCOPES: frozenset[str] = frozenset({
    # Modules
    "finance", "crm", "hr", "calendar", "projects", "support", "ai", "agent",
    "ecommerce", "inventory", "manufacturing", "supply-chain", "pos", "kds",
    "loyalty", "mail", "drive", "notes", "chat", "analytics", "forms",
    "booking", "support",
    # Infrastructure
    "auth", "admin", "docker", "deps", "ci", "migrations", "core", "db",
    "api", "frontend", "backend", "handbook", "docs",
})

# ── Commit subject pattern ────────────────────────────────────────────────────

# type(scope): description   OR   type: description   OR   type!: description
SUBJECT_RE = re.compile(
    r"^(?P<type>[a-z]+)(?P<breaking>!)?(?:\((?P<scope>[^)]+)\))?:\s*(?P<desc>.+)$"
)

# ── Lines to always skip (merge commits, revert squash messages, etc.) ────────

SKIP_PREFIXES = (
    "Merge ",
    "Revert ",
    "Initial commit",
    "initial commit",
)


def validate(msg_path: str) -> int:
    """
    Validate the commit message at `msg_path`.

    Returns 0 for valid, 1 for invalid.
    """
    path = Path(msg_path)
    if not path.exists():
        print(f"[check-commit-msg] File not found: {msg_path}", file=sys.stderr)
        return 1

    raw = path.read_text(encoding="utf-8")

    # Strip comment lines (lines starting with #)
    lines = [line for line in raw.splitlines() if not line.startswith("#")]
    # Remove trailing blank lines
    while lines and not lines[-1].strip():
        lines.pop()

    if not lines:
        print("[check-commit-msg] ✗ Commit message is empty.", file=sys.stderr)
        _print_help()
        return 1

    subject = lines[0].strip()

    # Skip special commit types that don't follow the convention
    if any(subject.startswith(prefix) for prefix in SKIP_PREFIXES):
        return 0

    # ── Validate subject ──────────────────────────────────────────────────────
    m = SUBJECT_RE.match(subject)
    if not m:
        print(
            f"[check-commit-msg] ✗ Invalid commit subject:\n  {subject!r}",
            file=sys.stderr,
        )
        print(
            "  Expected format: type(scope): description",
            file=sys.stderr,
        )
        _print_help()
        return 1

    commit_type = m.group("type")
    commit_scope = m.group("scope")
    desc = m.group("desc").strip()

    # ── Validate type ─────────────────────────────────────────────────────────
    if commit_type not in VALID_TYPES:
        print(
            f"[check-commit-msg] ✗ Unknown commit type: {commit_type!r}\n"
            f"  Valid types: {', '.join(sorted(VALID_TYPES))}",
            file=sys.stderr,
        )
        return 1

    # ── Validate scope (if provided) ──────────────────────────────────────────
    if commit_scope and commit_scope not in VALID_SCOPES:
        print(
            f"[check-commit-msg] ✗ Unknown scope: {commit_scope!r}\n"
            f"  Valid scopes: {', '.join(sorted(VALID_SCOPES))}",
            file=sys.stderr,
        )
        return 1

    # ── Validate description ──────────────────────────────────────────────────
    if len(desc) < 10:
        print(
            f"[check-commit-msg] ✗ Description too short ({len(desc)} chars). "
            "Write a meaningful description (≥ 10 chars).",
            file=sys.stderr,
        )
        return 1

    if len(subject) > 100:
        print(
            f"[check-commit-msg] ✗ Subject line too long ({len(subject)} chars). "
            "Keep it under 100 characters.",
            file=sys.stderr,
        )
        return 1

    # Description should not end with a period
    if desc.endswith("."):
        print(
            "[check-commit-msg] ✗ Description should not end with a period.",
            file=sys.stderr,
        )
        return 1

    # ── Optional: check blank line between subject and body ───────────────────
    if len(lines) > 1 and lines[1].strip():
        print(
            "[check-commit-msg] ✗ Add a blank line between the commit subject and body.",
            file=sys.stderr,
        )
        return 1

    return 0


def _print_help() -> None:
    print(
        """
[check-commit-msg] Examples of valid commit messages:

  feat(finance): add recurring invoice auto-generation
  fix(crm): prevent duplicate contact creation on form submission
  docs(hr): expand payroll Kenya compliance section
  refactor(core): extract JWT validation into dedicated helper
  chore(deps): upgrade SQLAlchemy to 2.0.36
  security(auth): rotate JWT secret key derivation to HKDF

  Breaking change:
  feat(api)!: remove deprecated /v0 endpoints

  Multi-line:
  fix(ecommerce): correct Mpesa payment status polling

  Mpesa STK push callbacks were being dropped when the payment
  gateway responded with code 1032 (request cancelled by user).
  Now handled explicitly with a user-facing error message.

  Closes #147
""",
        file=sys.stderr,
    )


def main() -> None:
    if len(sys.argv) != 2:
        print(
            f"Usage: {sys.argv[0]} <commit-msg-file>",
            file=sys.stderr,
        )
        sys.exit(1)

    exit_code = validate(sys.argv[1])
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
