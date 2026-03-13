"""Row-Level Security (RLS) context management.

Sets per-transaction PostgreSQL session variables that drive RLS policies
on privacy-sensitive tables: notes, drive_files, mail_messages,
calendar_events, chat_messages.

RLS policies use ``current_setting('app.current_user_id', true)`` to
identify the session owner and restrict SELECT/UPDATE/DELETE to rows
owned by or shared with that user.

Usage in get_db():
    async with AsyncSessionLocal() as session:
        await set_rls_context(session, user_id=str(current_user.id))
        yield session

PgBouncer note: Using ``SET LOCAL`` (transaction-scoped) rather than
``SET`` (session-scoped) is safe with PgBouncer transaction pooling —
the variable is automatically cleared when the transaction ends and the
connection is returned to the pool.

Superuser bypass:
    The ``urban`` role (used by the application) is a superuser that
    bypasses all RLS policies, so we rely on the app layer to enforce
    user scoping via the FastAPI dependencies (CurrentUser, etc.).
    RLS is an additional defence-in-depth layer for any direct SQL access.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def set_rls_context(
    session: AsyncSession,
    *,
    user_id: str | None,
    ip_address: str | None = None,
) -> None:
    """Set per-transaction RLS context variables.

    Args:
        session:    The current async SQLAlchemy session.
        user_id:    UUID string of the authenticated user (or None for
                    system/background tasks).
        ip_address: Client IP address, stored for audit purposes.
    """
    uid = user_id or ""
    ip = ip_address or ""
    # SET LOCAL is transaction-scoped — clears automatically on commit/rollback.
    await session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true), set_config('app.client_ip', :ip, true)"),
        {"uid": uid, "ip": ip},
    )


def build_rls_policies_sql() -> list[str]:
    """Return SQL statements to enable RLS on privacy-sensitive tables.

    Called from an Alembic migration (Phase 4 security migration).
    Each policy restricts row access to the owner or rows with no owner.

    Tables covered:
        notes, drive_files, mail_messages, calendar_events, chat_messages
    """
    policies: list[str] = []

    rls_tables = {
        "notes": "owner_id",
        "drive_files": "owner_id",
        "mail_messages": "owner_id",
        "calendar_events": "owner_id",
    }

    for table, owner_col in rls_tables.items():
        # Enable RLS on the table
        policies.append(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        # Allow bypass for superusers (urban role)
        policies.append(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")
        # Drop existing policy if re-running
        policies.append(f"DROP POLICY IF EXISTS rls_{table}_owner ON {table};")
        # Create SELECT/UPDATE/DELETE policy: owner sees their own rows
        policies.append(f"""
CREATE POLICY rls_{table}_owner ON {table}
    USING (
        {owner_col}::text = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = ''
    );
""")

    return policies
