#!/usr/bin/env bash
# ── Changelog Check ────────────────────────────────────────────────────────
#
# Verifies that CHANGELOG.md has been updated when source code files change.
# Designed to run in CI (GitHub Actions) on pull requests and as a pre-commit hook.
#
# Usage:
#     bash scripts/changelog-check.sh
#
# Exit codes:
#     0 — CHANGELOG.md was updated, or no source files changed
#     1 — Source files changed but CHANGELOG.md was not updated
#
# What counts as "source files":
#     - backend/app/**/*.py (Python backend code)
#     - frontend/src/**/*.ts, *.tsx (TypeScript frontend code)
#     - docker-compose.yml, Dockerfile* (infrastructure changes)
#
# What does NOT require a changelog update:
#     - Documentation-only changes (docs/, *.md except CHANGELOG.md)
#     - Test-only changes (tests/, *.test.*, *.spec.*)
#     - CI/CD changes (.github/*, scripts/*)
#     - Config/tooling changes (*.json, *.yaml config files)

set -euo pipefail

# ── Determine changed files ───────────────────────────────────────────────

# In CI (GitHub Actions PR), compare against the base branch
if [ -n "${GITHUB_BASE_REF:-}" ]; then
    BASE_REF="origin/${GITHUB_BASE_REF}"
    git fetch origin "${GITHUB_BASE_REF}" --depth=1 2>/dev/null || true
    CHANGED_FILES=$(git diff --name-only "${BASE_REF}...HEAD" 2>/dev/null || echo "")
else
    # Local: compare against main or last commit
    if git rev-parse --verify main >/dev/null 2>&1; then
        CHANGED_FILES=$(git diff --name-only main...HEAD 2>/dev/null || echo "")
    else
        CHANGED_FILES=$(git diff --name-only HEAD~1 2>/dev/null || echo "")
    fi
fi

if [ -z "${CHANGED_FILES}" ]; then
    echo "changelog-check: No changed files detected. Skipping."
    exit 0
fi

# ── Check for source code changes ─────────────────────────────────────────

SOURCE_CHANGED=false

while IFS= read -r file; do
    case "${file}" in
        backend/app/*.py)         SOURCE_CHANGED=true ;;
        frontend/src/*.ts)        SOURCE_CHANGED=true ;;
        frontend/src/*.tsx)       SOURCE_CHANGED=true ;;
        docker-compose.yml)       SOURCE_CHANGED=true ;;
        Dockerfile*)              SOURCE_CHANGED=true ;;
    esac
done <<< "${CHANGED_FILES}"

if [ "${SOURCE_CHANGED}" = false ]; then
    echo "changelog-check: No source code changes detected. Changelog update not required."
    exit 0
fi

# ── Check if CHANGELOG.md was updated ─────────────────────────────────────

CHANGELOG_UPDATED=false

while IFS= read -r file; do
    if [ "${file}" = "CHANGELOG.md" ]; then
        CHANGELOG_UPDATED=true
        break
    fi
done <<< "${CHANGED_FILES}"

if [ "${CHANGELOG_UPDATED}" = true ]; then
    echo "changelog-check: PASS — CHANGELOG.md has been updated."
    exit 0
else
    echo ""
    echo "================================================================"
    echo "  changelog-check: FAIL"
    echo "================================================================"
    echo ""
    echo "  Source code was modified but CHANGELOG.md was not updated."
    echo ""
    echo "  Please add an entry under [Unreleased] in CHANGELOG.md"
    echo "  describing your changes. Use the appropriate category:"
    echo ""
    echo "    ### Added      — New features"
    echo "    ### Changed    — Changes to existing features"
    echo "    ### Deprecated — Features to be removed in future"
    echo "    ### Removed    — Features removed"
    echo "    ### Fixed      — Bug fixes"
    echo "    ### Security   — Security-related changes"
    echo ""
    echo "  Example:"
    echo "    ## [Unreleased]"
    echo "    ### Added"
    echo "    - Finance: Multi-currency invoice support"
    echo ""
    echo "================================================================"
    exit 1
fi
