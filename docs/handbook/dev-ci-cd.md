---
title: CI/CD Pipeline
slug: dev-ci-cd
category: development
article_type: guide
module: admin
tags: [ci-cd, github-actions, testing, deployment, pre-commit]
sort_order: 4
is_pinned: false
excerpt: Understand the Urban ERP CI pipeline, pre-commit hooks, and how code gets from development to production.
---

# CI/CD Pipeline

## CI Pipeline Overview

The CI pipeline runs on every push and PR via GitHub Actions (`.github/workflows/ci.yml`).

### Jobs (in order)

| Job | What It Does | Fails If |
|-----|-------------|---------|
| `lint-backend` | Ruff lint + format check | Any lint error or unformatted code |
| `typecheck-frontend` | `tsc --noEmit` | TypeScript type errors |
| `test-backend` | pytest with coverage | Any failing test |
| `test-frontend` | Vitest | Any failing test |
| `doc-coverage` | `scripts/doc-coverage.py` | Backend <50% or frontend <30% |
| `changelog-check` | Verifies CHANGELOG.md updated on source PRs | PR changes source without CHANGELOG update |
| `build` | Docker image build | Any of the above jobs failed |

`build` only runs if all previous jobs pass — it's the gate before deployment.

## Pre-commit Hooks

Install once per developer machine:

```bash
pip install pre-commit
pre-commit install
pre-commit install --hook-type commit-msg
```

### Hooks that run on every commit

| Hook | What It Checks |
|------|---------------|
| `commit-msg-check` | Conventional commit format |
| `trailing-whitespace` | No trailing spaces |
| `end-of-file-fixer` | Files end with a newline |
| `check-yaml` / `check-json` / `check-toml` | Valid syntax |
| `check-merge-conflict` | No unresolved conflict markers |
| `no-commit-to-branch main` | Blocks direct commits to main |
| `ruff` | Python linting (auto-fixes where possible) |
| `ruff-format` | Python formatting |
| `detect-secrets` | No credentials in code |
| `doc-coverage --changed-only` | Changed files meet docstring threshold |

### Hooks that run on push

| Hook | What It Checks |
|------|---------------|
| `changelog-check` | CHANGELOG.md updated if source files changed |

## Conventional Commits

All commit messages must follow `type(scope): description`:

```
feat(crm): add pipeline stage drag-and-drop
fix(finance): correct VAT rounding on split payments
docs(hr): expand Kenya payroll FAQ
chore(deps): upgrade SQLAlchemy to 2.0.40
```

Valid types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `security`, `revert`
Valid scopes: module names (`finance`, `crm`, `hr`, ...) or infra areas (`auth`, `docker`, `ci`, `migrations`, ...)

## Branch Strategy

- All work happens on feature branches
- Direct commits to `main` are blocked by pre-commit hook
- PRs require: all CI jobs pass + at least 1 approval

## Deploying

```bash
# On the server
cd "/path/to/urban-erp"
git pull origin main
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

## Rolling Back

```bash
# Revert the last migration
docker compose exec backend alembic downgrade -1

# Restart with the previous image (requires it to be tagged)
docker compose up -d
```

> **Tip:** Test your migrations with `alembic downgrade -1 && alembic upgrade head` locally before pushing — this verifies the downgrade path works and catches missing `down_revision` bugs.
