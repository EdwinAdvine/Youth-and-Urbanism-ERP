#!/usr/bin/env python3
"""Sync handbook articles from Markdown source files into the database.

Extends the original seed_handbook.py with upsert logic: articles are matched
by slug and updated if content has changed, or created if new. This enables
incremental updates without duplicating content.

Source files live in docs/handbook/ with YAML frontmatter:

    ---
    title: Getting Started with Finance
    slug: getting-started-finance
    category: finance
    article_type: guide
    module: finance
    tags: [finance, invoicing, getting-started]
    sort_order: 0
    is_pinned: false
    excerpt: Learn how to set up your chart of accounts and create your first invoice.
    ai_shortcut_prompt: How do I create an invoice?
    ---

    # Getting Started with Finance
    ...markdown content...

Usage:
    # Sync all articles from docs/handbook/
    docker compose exec backend python -m scripts.sync_handbook

    # Dry run (preview changes without writing to DB)
    docker compose exec backend python -m scripts.sync_handbook --dry-run

    # Sync only a specific category
    docker compose exec backend python -m scripts.sync_handbook --category=finance

    # Verbose output
    docker compose exec backend python -m scripts.sync_handbook --verbose
"""
from __future__ import annotations

import argparse
import asyncio
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import yaml
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.handbook import HandbookArticle, HandbookCategory
from app.models.user import User

# ── Project paths ──────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
HANDBOOK_SOURCE_DIR = PROJECT_ROOT / "docs" / "handbook"


# ── Helpers ────────────────────────────────────────────────────────────────

def _uid() -> uuid.UUID:
    """Generate a new UUID v4."""
    return uuid.uuid4()


def _slug(text: str) -> str:
    """Convert text to a URL-safe slug."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _read_time(text: str) -> int:
    """Estimate reading time in minutes (200 words/min)."""
    words = len(text.split())
    return max(1, round(words / 200))


def parse_markdown_file(filepath: Path) -> dict | None:
    """Parse a Markdown file with YAML frontmatter.

    Returns a dict with frontmatter fields + 'content_markdown' key,
    or None if the file has no valid frontmatter.

    Expected format:
        ---
        title: ...
        slug: ...
        category: ...
        ---
        # Markdown content here
    """
    text = filepath.read_text(encoding="utf-8")

    # Split frontmatter from content
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.DOTALL)
    if not match:
        return None

    frontmatter_raw = match.group(1)
    content = match.group(2).strip()

    try:
        frontmatter = yaml.safe_load(frontmatter_raw)
    except yaml.YAMLError:
        return None

    if not isinstance(frontmatter, dict):
        return None

    # Validate required fields
    required = {"title", "slug", "category"}
    if not required.issubset(frontmatter.keys()):
        print(f"  WARN: Missing required fields in {filepath.name}: {required - frontmatter.keys()}")
        return None

    frontmatter["content_markdown"] = content
    return frontmatter


# ── Sync logic ─────────────────────────────────────────────────────────────

async def sync_articles(
    db: AsyncSession,
    *,
    category_filter: str | None = None,
    dry_run: bool = False,
    verbose: bool = False,
) -> None:
    """Sync all handbook article source files into the database.

    For each .md file in docs/handbook/:
    1. Parse YAML frontmatter + markdown content
    2. Look up the article by slug
    3. If exists and content changed → update
    4. If doesn't exist → create
    5. Skip if content is identical (no-op)

    Args:
        db: Async database session
        category_filter: Only sync articles in this category slug
        dry_run: If True, print what would happen without writing
        verbose: Print details for every file processed
    """
    if not HANDBOOK_SOURCE_DIR.exists():
        print(f"Source directory not found: {HANDBOOK_SOURCE_DIR}")
        print("Create docs/handbook/ and add .md files with YAML frontmatter.")
        return

    # Get author (first superadmin or any user)
    result = await db.execute(
        select(User).where(User.is_superadmin == True).limit(1)  # noqa: E712
    )
    author = result.scalar_one_or_none()
    if not author:
        result = await db.execute(select(User).limit(1))
        author = result.scalar_one_or_none()
    if not author:
        print("ERROR: No users found in database. Cannot sync handbook.")
        return

    print(f"Author: {author.full_name} ({author.email})")

    # Load existing categories by slug
    cat_result = await db.execute(select(HandbookCategory))
    categories = {cat.slug: cat for cat in cat_result.scalars().all()}
    print(f"Found {len(categories)} existing categories.")

    # Load existing articles by slug
    art_result = await db.execute(select(HandbookArticle))
    existing_articles = {art.slug: art for art in art_result.scalars().all()}
    print(f"Found {len(existing_articles)} existing articles.")

    # Scan source files
    md_files = sorted(HANDBOOK_SOURCE_DIR.glob("**/*.md"))
    if not md_files:
        print(f"No .md files found in {HANDBOOK_SOURCE_DIR}")
        return

    print(f"Found {len(md_files)} source files.\n")

    stats = {"created": 0, "updated": 0, "skipped": 0, "errors": 0}

    for filepath in md_files:
        data = parse_markdown_file(filepath)
        if data is None:
            if verbose:
                print(f"  SKIP: {filepath.name} (no valid frontmatter)")
            stats["errors"] += 1
            continue

        slug = data["slug"]
        category_slug = data["category"]

        # Apply category filter
        if category_filter and category_slug != category_filter:
            continue

        # Look up category
        category = categories.get(category_slug)
        if not category:
            print(f"  WARN: Category '{category_slug}' not found for {filepath.name}. Skipping.")
            stats["errors"] += 1
            continue

        content = data["content_markdown"]

        if slug in existing_articles:
            # Check if content changed
            existing = existing_articles[slug]
            if existing.content_markdown == content and existing.title == data["title"]:
                if verbose:
                    print(f"  SKIP: {slug} (unchanged)")
                stats["skipped"] += 1
                continue

            # Update existing article
            if dry_run:
                print(f"  UPDATE: {slug} (content changed)")
            else:
                await db.execute(
                    update(HandbookArticle)
                    .where(HandbookArticle.slug == slug)
                    .values(
                        title=data["title"],
                        content_markdown=content,
                        excerpt=data.get("excerpt", ""),
                        article_type=data.get("article_type", "guide"),
                        module=data.get("module"),
                        tags=data.get("tags", []),
                        sort_order=data.get("sort_order", 0),
                        is_pinned=data.get("is_pinned", False),
                        ai_shortcut_prompt=data.get("ai_shortcut_prompt"),
                        estimated_read_time=_read_time(content),
                        category_id=category.id,
                    )
                )
                if verbose:
                    print(f"  UPDATE: {slug}")
            stats["updated"] += 1
        else:
            # Create new article
            if dry_run:
                print(f"  CREATE: {slug} → {data['title']}")
            else:
                article = HandbookArticle(
                    id=_uid(),
                    title=data["title"],
                    slug=slug,
                    content_markdown=content,
                    excerpt=data.get("excerpt", ""),
                    category_id=category.id,
                    author_id=author.id,
                    status="published",
                    article_type=data.get("article_type", "guide"),
                    module=data.get("module"),
                    tags=data.get("tags", []),
                    sort_order=data.get("sort_order", 0),
                    is_pinned=data.get("is_pinned", False),
                    ai_shortcut_prompt=data.get("ai_shortcut_prompt"),
                    estimated_read_time=_read_time(content),
                )
                db.add(article)
                if verbose:
                    print(f"  CREATE: {slug}")
            stats["created"] += 1

    if not dry_run:
        await db.commit()

    # Print summary
    print(f"\n{'─' * 50}")
    mode = "DRY RUN" if dry_run else "SYNC COMPLETE"
    print(f"  {mode}")
    print(f"  Created: {stats['created']}")
    print(f"  Updated: {stats['updated']}")
    print(f"  Skipped: {stats['skipped']} (unchanged)")
    print(f"  Errors:  {stats['errors']}")
    print(f"{'─' * 50}")


# ── CLI ────────────────────────────────────────────────────────────────────

async def main() -> None:
    """Parse CLI args and run the handbook sync."""
    parser = argparse.ArgumentParser(description="Sync handbook articles from docs/handbook/ to database")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to DB")
    parser.add_argument("--category", type=str, default=None, help="Only sync articles in this category slug")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print details for every file")
    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        await sync_articles(
            db,
            category_filter=args.category,
            dry_run=args.dry_run,
            verbose=args.verbose,
        )


if __name__ == "__main__":
    asyncio.run(main())
