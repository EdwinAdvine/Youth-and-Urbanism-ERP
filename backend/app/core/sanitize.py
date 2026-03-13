"""Input sanitization helpers for Urban Vibes Dynamics.

Provides utilities to safely escape user-supplied strings before they are
used in database queries. Use these helpers everywhere you build dynamic SQL
LIKE/ILIKE patterns from user input to prevent wildcard injection attacks
(where a user types '%' or '_' to match unintended rows).

Usage:
    from app.core.sanitize import like_pattern

    # Safe ILIKE search — user input cannot escape the pattern boundary
    results = await db.execute(
        select(Contact).where(Contact.name.ilike(like_pattern(search_term)))
    )

    # Escape only (when you want prefix or suffix control yourself):
    from app.core.sanitize import escape_like
    pattern = f"{escape_like(prefix)}%"
"""
from __future__ import annotations


def escape_like(value: str) -> str:
    """Escape special SQL LIKE/ILIKE pattern characters (%, _).

    Use this whenever building ``%{value}%`` patterns for SQLAlchemy
    ``.ilike()`` / ``.like()`` to prevent wildcard injection.
    """
    return value.replace("%", r"\%").replace("_", r"\_")


def like_pattern(value: str) -> str:
    """Return an escaped ``%value%`` pattern safe for ILIKE queries."""
    return f"%{escape_like(value)}%"
