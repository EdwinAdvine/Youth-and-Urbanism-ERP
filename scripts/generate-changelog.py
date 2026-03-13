#!/usr/bin/env python3
"""Generate CHANGELOG.md entries from conventional commits.

Reads git commits since the last tag (or since the beginning if no tags exist),
groups them by type and scope, and prepends a new version section to CHANGELOG.md.

Also optionally creates a Handbook release note article in docs/handbook/
so the in-app handbook stays current with every release.

Usage:
    # Dry run — print what would be added without modifying files
    python scripts/generate-changelog.py --dry-run

    # Generate changelog for a new version
    python scripts/generate-changelog.py --version 1.1.0

    # Generate and also create a handbook release note article
    python scripts/generate-changelog.py --version 1.1.0 --handbook

Conventional commit format expected:
    type(scope): description

    Types: feat, fix, docs, refactor, test, chore, perf, security
    Scopes: finance, crm, hr, calendar, projects, support, ai, ecommerce,
            inventory, manufacturing, supply-chain, pos, mail, drive, notes,
            chat, analytics, forms, booking, auth, admin, docker, deps

Exit codes:
    0 — success
    1 — error (no git repo, bad version format, etc.)
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

# ── Project root ─────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent.parent
CHANGELOG_PATH = ROOT / "CHANGELOG.md"
HANDBOOK_DIR = ROOT / "docs" / "handbook"

# ── Commit type → human-readable section heading ─────────────────────────────

TYPE_HEADINGS: dict[str, str] = {
    "feat":     "### Added",
    "fix":      "### Fixed",
    "perf":     "### Changed",
    "refactor": "### Changed",
    "docs":     "### Changed",
    "security": "### Security",
    "chore":    "### Changed",
    "test":     "### Changed",
}

# Commit types that are interesting enough to appear in the user-facing changelog.
# "test" and "chore" are included but de-prioritised.
INCLUDE_TYPES = set(TYPE_HEADINGS.keys())

# Commit types that get omitted entirely (too noisy for public changelog).
OMIT_TYPES = {"wip", "style", "ci", "build"}

# ── Conventional commit regex ─────────────────────────────────────────────────

# Matches: type(scope): description
# OR:      type: description  (scope optional)
# OR:      type!: description (breaking change marker)
COMMIT_RE = re.compile(
    r"^(?P<type>[a-z]+)(?P<breaking>!)?(?:\((?P<scope>[^)]+)\))?:\s*(?P<desc>.+)$"
)


# ── Git helpers ───────────────────────────────────────────────────────────────

def _run(cmd: list[str]) -> str:
    """Run a git command and return stdout, stripped."""
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{result.stderr.strip()}")
    return result.stdout.strip()


def get_last_tag() -> str | None:
    """Return the most recent git tag, or None if no tags exist."""
    try:
        tag = _run(["git", "describe", "--tags", "--abbrev=0"])
        return tag if tag else None
    except RuntimeError:
        return None


def get_commits_since(ref: str | None) -> list[tuple[str, str]]:
    """
    Return a list of (hash, subject) pairs for commits since `ref`.

    If `ref` is None, returns all commits in the repository.
    """
    if ref:
        range_spec = f"{ref}..HEAD"
    else:
        range_spec = "HEAD"

    output = _run(["git", "log", range_spec, "--format=%H %s"])
    commits = []
    for line in output.splitlines():
        if not line.strip():
            continue
        parts = line.split(" ", 1)
        if len(parts) == 2:
            commits.append((parts[0], parts[1]))
    return commits


def parse_commit(subject: str) -> dict | None:
    """
    Parse a conventional commit subject into a dict with keys:
    type, scope, breaking, desc

    Returns None for commits that don't follow the convention or should be omitted.
    """
    m = COMMIT_RE.match(subject.strip())
    if not m:
        return None
    t = m.group("type").lower()
    if t in OMIT_TYPES:
        return None
    if t not in INCLUDE_TYPES:
        # Unknown type — include as-is under Changed
        t = "chore"
    return {
        "type": t,
        "scope": m.group("scope"),
        "breaking": bool(m.group("breaking")),
        "desc": m.group("desc"),
    }


# ── Changelog section builder ─────────────────────────────────────────────────

def build_section(version: str, commits: list[tuple[str, str]]) -> str:
    """
    Build a complete changelog section for the given version from a list of
    (hash, subject) commit pairs. Returns a markdown string.
    """
    today = date.today().isoformat()
    lines: list[str] = [f"## [{version}] — {today}", ""]

    # Separate breaking changes
    breaking: list[str] = []

    # Group by heading: heading → list of formatted lines
    grouped: dict[str, list[str]] = defaultdict(list)

    for _, subject in commits:
        parsed = parse_commit(subject)
        if not parsed:
            continue

        scope_prefix = f"**{parsed['scope']}**: " if parsed["scope"] else ""
        entry = f"- {scope_prefix}{parsed['desc']}"

        if parsed["breaking"]:
            breaking.append(entry)

        heading = TYPE_HEADINGS.get(parsed["type"], "### Changed")
        grouped[heading].append(entry)

    # Breaking changes first
    if breaking:
        lines.append("### ⚠ Breaking Changes")
        lines.extend(breaking)
        lines.append("")

    # Ordered sections
    for heading in ["### Added", "### Changed", "### Fixed", "### Security"]:
        entries = grouped.get(heading, [])
        if entries:
            lines.append(heading)
            lines.extend(entries)
            lines.append("")

    return "\n".join(lines)


# ── CHANGELOG.md updater ──────────────────────────────────────────────────────

def prepend_to_changelog(section: str, dry_run: bool = False) -> None:
    """Prepend `section` to CHANGELOG.md, after the top-level header block."""
    if not CHANGELOG_PATH.exists():
        print(f"[generate-changelog] CHANGELOG.md not found at {CHANGELOG_PATH}", file=sys.stderr)
        sys.exit(1)

    content = CHANGELOG_PATH.read_text(encoding="utf-8")

    # Insert after the first H1 + intro paragraph (before first ## [version])
    # Find the first "## [" marker
    insert_pos = content.find("\n## [")
    if insert_pos == -1:
        # No existing version sections — append to end
        new_content = content.rstrip() + "\n\n" + section + "\n"
    else:
        new_content = content[: insert_pos + 1] + section + "\n" + content[insert_pos + 1 :]

    if dry_run:
        print("─" * 60)
        print("DRY RUN — would prepend to CHANGELOG.md:")
        print("─" * 60)
        print(section)
        print("─" * 60)
    else:
        CHANGELOG_PATH.write_text(new_content, encoding="utf-8")
        print(f"[generate-changelog] ✓ Prepended version section to {CHANGELOG_PATH}")


# ── Handbook release note writer ──────────────────────────────────────────────

def write_handbook_article(version: str, section: str, dry_run: bool = False) -> None:
    """
    Write a Handbook release note article to docs/handbook/ so the in-app
    handbook reflects the new release.
    """
    today = date.today().isoformat()
    slug = f"release-notes-{version.replace('.', '-')}"
    filename = HANDBOOK_DIR / f"release-{version.replace('.', '-')}.md"

    # Strip markdown headings for the excerpt
    changes_preview = [
        line.lstrip("- ").strip()
        for line in section.splitlines()
        if line.startswith("- ") and not line.startswith("- **")
    ][:3]
    excerpt = "; ".join(changes_preview[:2]) + "." if changes_preview else f"Release {version} changelog."

    frontmatter = f"""---
title: "Release Notes — v{version}"
slug: "{slug}"
category: "getting-started"
article_type: "release_note"
tags: [release, changelog, v{version}]
sort_order: 99
is_pinned: false
excerpt: "{excerpt}"
---

# Release Notes — v{version}

*Released {today}*

{section.split(chr(10), 1)[1] if chr(10) in section else section}
"""

    if dry_run:
        print(f"[generate-changelog] DRY RUN — would write handbook article to {filename}")
        print(frontmatter[:400])
    else:
        HANDBOOK_DIR.mkdir(parents=True, exist_ok=True)
        filename.write_text(frontmatter, encoding="utf-8")
        print(f"[generate-changelog] ✓ Wrote handbook release note to {filename}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate CHANGELOG.md entries from conventional git commits."
    )
    parser.add_argument(
        "--version",
        required=False,
        default=None,
        help="Version string to use (e.g. 1.1.0). Defaults to prompting for input.",
    )
    parser.add_argument(
        "--since",
        default=None,
        help="Git ref to collect commits from (default: auto-detect last tag).",
    )
    parser.add_argument(
        "--handbook",
        action="store_true",
        help="Also create a Handbook release note article in docs/handbook/.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be written without modifying any files.",
    )
    args = parser.parse_args()

    # ── Resolve version ───────────────────────────────────────────────────────
    version = args.version
    if not version:
        version = input("Enter version (e.g. 1.1.0): ").strip()
    if not re.match(r"^\d+\.\d+\.\d+", version):
        print(f"[generate-changelog] Invalid version format: {version}", file=sys.stderr)
        sys.exit(1)

    # ── Collect commits ───────────────────────────────────────────────────────
    since = args.since or get_last_tag()
    if since:
        print(f"[generate-changelog] Collecting commits since {since!r}...")
    else:
        print("[generate-changelog] No previous tag found — collecting all commits...")

    try:
        commits = get_commits_since(since)
    except RuntimeError as e:
        print(f"[generate-changelog] Git error: {e}", file=sys.stderr)
        sys.exit(1)

    if not commits:
        print("[generate-changelog] No commits found — nothing to generate.")
        sys.exit(0)

    # Filter to only conventional commits
    conventional = [(h, s) for h, s in commits if parse_commit(s)]
    print(f"[generate-changelog] {len(conventional)}/{len(commits)} commits follow conventional format.")

    if not conventional:
        print("[generate-changelog] No conventional commits found — nothing to generate.")
        sys.exit(0)

    # ── Build and write section ───────────────────────────────────────────────
    section = build_section(version, conventional)
    prepend_to_changelog(section, dry_run=args.dry_run)

    if args.handbook:
        write_handbook_article(version, section, dry_run=args.dry_run)

    if not args.dry_run:
        print(f"[generate-changelog] ✓ Done. Don't forget to: git tag v{version}")


if __name__ == "__main__":
    main()
