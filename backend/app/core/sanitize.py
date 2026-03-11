"""Input sanitization helpers for Urban ERP."""
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
