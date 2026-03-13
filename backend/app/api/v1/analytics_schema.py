"""Analytics Schema Introspection API — zero-config data connectivity.

Exposes the full ERP database schema (tables, columns, types, foreign keys)
grouped by module, enabling the dashboard builder and copilot to auto-discover
all available data sources without manual configuration.
"""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from app.core.deps import CurrentUser, DBSession

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Module → table prefix mapping ────────────────────────────────────────────
_MODULE_PREFIXES: dict[str, list[str]] = {
    "finance": ["finance_", "journal_"],
    "hr": ["hr_", "employees", "departments", "payroll_"],
    "crm": ["crm_", "contacts", "deals", "pipelines"],
    "projects": ["projects", "project_"],
    "inventory": ["inventory_", "stock_", "products", "warehouses"],
    "support": ["support_"],
    "ecommerce": ["ecommerce_", "orders", "carts"],
    "pos": ["pos_"],
    "manufacturing": ["manufacturing_", "work_orders", "bom_"],
    "supplychain": ["supply_chain_", "purchase_orders"],
    "analytics": ["analytics_"],
    "calendar": ["calendar_", "events"],
    "mail": ["mail_", "emails"],
    "drive": ["drive_", "files"],
    "docs": ["docs_", "documents"],
    "meetings": ["meetings"],
    "notes": ["notes"],
    "forms": ["forms"],
    "users": ["users", "roles", "permissions"],
}


# ── Response schemas ─────────────────────────────────────────────────────────
class ColumnInfo(BaseModel):
    name: str
    data_type: str
    is_nullable: bool
    column_default: str | None = None
    is_primary_key: bool = False


class ForeignKeyInfo(BaseModel):
    column: str
    references_table: str
    references_column: str


class TableInfo(BaseModel):
    table_name: str
    module: str
    row_count_estimate: int
    columns: list[ColumnInfo]
    foreign_keys: list[ForeignKeyInfo]
    primary_keys: list[str]


class SchemaOverview(BaseModel):
    total_tables: int
    total_columns: int
    modules: dict[str, list[str]]


class SchemaResponse(BaseModel):
    overview: SchemaOverview
    tables: list[TableInfo]


class RelationshipInfo(BaseModel):
    from_table: str
    from_column: str
    to_table: str
    to_column: str
    relationship_type: str  # many-to-one, one-to-many


class RelationshipsResponse(BaseModel):
    relationships: list[RelationshipInfo]
    total: int


# ── Helpers ──────────────────────────────────────────────────────────────────
def _classify_table(table_name: str) -> str:
    """Determine which ERP module a table belongs to based on its name."""
    for module, prefixes in _MODULE_PREFIXES.items():
        for prefix in prefixes:
            if table_name.startswith(prefix) or table_name == prefix:
                return module
    return "other"


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.get("/schema", response_model=SchemaResponse)
async def get_schema(
    db: DBSession,
    user: CurrentUser,
    module: str | None = Query(None, description="Filter by module name"),
):
    """Return full database schema grouped by module.

    Introspects information_schema to return all tables, columns, types,
    and foreign key relationships. This powers the dashboard builder's
    data source picker and the Copilot's schema context.
    """
    # Get all tables with estimated row counts
    tables_sql = text("""
        SELECT
            t.table_name,
            COALESCE(s.n_live_tup, 0) AS row_estimate
        FROM information_schema.tables t
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
    """)
    tables_result = await db.execute(tables_sql)
    raw_tables = tables_result.fetchall()

    # Get all columns
    columns_sql = text("""
        SELECT
            c.table_name,
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position
    """)
    columns_result = await db.execute(columns_sql)
    raw_columns = columns_result.fetchall()

    # Get primary keys
    pk_sql = text("""
        SELECT
            tc.table_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
    """)
    pk_result = await db.execute(pk_sql)
    raw_pks = pk_result.fetchall()

    # Get foreign keys
    fk_sql = text("""
        SELECT
            tc.table_name AS from_table,
            kcu.column_name AS from_column,
            ccu.table_name AS to_table,
            ccu.column_name AS to_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
    """)
    fk_result = await db.execute(fk_sql)
    raw_fks = fk_result.fetchall()

    # Index columns by table
    columns_by_table: dict[str, list[ColumnInfo]] = {}
    for row in raw_columns:
        tbl = row[0]
        columns_by_table.setdefault(tbl, []).append(
            ColumnInfo(
                name=row[1],
                data_type=row[2],
                is_nullable=row[3] == "YES",
                column_default=row[4],
            )
        )

    # Index PKs by table
    pks_by_table: dict[str, list[str]] = {}
    for row in raw_pks:
        pks_by_table.setdefault(row[0], []).append(row[1])

    # Mark PK columns
    for tbl, cols in columns_by_table.items():
        pk_cols = set(pks_by_table.get(tbl, []))
        for col in cols:
            if col.name in pk_cols:
                col.is_primary_key = True

    # Index FKs by table
    fks_by_table: dict[str, list[ForeignKeyInfo]] = {}
    for row in raw_fks:
        fks_by_table.setdefault(row[0], []).append(
            ForeignKeyInfo(
                column=row[1],
                references_table=row[2],
                references_column=row[3],
            )
        )

    # Build table info list
    tables: list[TableInfo] = []
    modules_index: dict[str, list[str]] = {}

    for row in raw_tables:
        table_name = row[0]
        row_estimate = row[1]
        table_module = _classify_table(table_name)

        # Skip alembic_version and internal tables
        if table_name in ("alembic_version",):
            continue

        # Apply module filter if provided
        if module and table_module != module:
            continue

        modules_index.setdefault(table_module, []).append(table_name)

        tables.append(
            TableInfo(
                table_name=table_name,
                module=table_module,
                row_count_estimate=row_estimate,
                columns=columns_by_table.get(table_name, []),
                foreign_keys=fks_by_table.get(table_name, []),
                primary_keys=pks_by_table.get(table_name, []),
            )
        )

    total_columns = sum(len(t.columns) for t in tables)

    return SchemaResponse(
        overview=SchemaOverview(
            total_tables=len(tables),
            total_columns=total_columns,
            modules=modules_index,
        ),
        tables=tables,
    )


@router.get("/schema/tables", response_model=list[str])
async def list_tables(
    db: DBSession,
    user: CurrentUser,
    module: str | None = Query(None),
):
    """Return a flat list of table names, optionally filtered by module."""
    sql = text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name != 'alembic_version'
        ORDER BY table_name
    """)
    result = await db.execute(sql)
    all_tables = [row[0] for row in result.fetchall()]

    if module:
        all_tables = [t for t in all_tables if _classify_table(t) == module]

    return all_tables


@router.get("/schema/tables/{table_name}/columns")
async def get_table_columns(
    table_name: str,
    db: DBSession,
    user: CurrentUser,
):
    """Return columns for a specific table with sample values."""
    # Verify table exists
    check_sql = text("""
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = :table_name
    """)
    result = await db.execute(check_sql, {"table_name": table_name})
    if result.scalar() == 0:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Table '{table_name}' not found")

    # Get columns
    cols_sql = text("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = :table_name
        ORDER BY ordinal_position
    """)
    cols_result = await db.execute(cols_sql, {"table_name": table_name})

    columns = []
    for row in cols_result.fetchall():
        columns.append({
            "name": row[0],
            "data_type": row[1],
            "is_nullable": row[2] == "YES",
            "column_default": row[3],
        })

    # Get sample values (first 5 rows) for non-sensitive columns
    try:
        # Sanitize table name to prevent SQL injection
        if not table_name.replace("_", "").isalnum():
            return {"table_name": table_name, "columns": columns, "sample_rows": []}

        sample_sql = text(f'SELECT * FROM "{table_name}" LIMIT 5')  # noqa: S608
        sample_result = await db.execute(sample_sql)
        sample_rows = []
        col_names = [c["name"] for c in columns]
        for row in sample_result.fetchall():
            sample_rows.append({
                col_names[i]: str(v) if v is not None else None
                for i, v in enumerate(row)
            })
    except Exception:
        sample_rows = []

    return {
        "table_name": table_name,
        "module": _classify_table(table_name),
        "columns": columns,
        "sample_rows": sample_rows,
    }


@router.get("/schema/relationships", response_model=RelationshipsResponse)
async def get_relationships(
    db: DBSession,
    user: CurrentUser,
    module: str | None = Query(None, description="Filter by module"),
):
    """Return all foreign key relationships, optionally filtered by module."""
    fk_sql = text("""
        SELECT
            tc.table_name AS from_table,
            kcu.column_name AS from_column,
            ccu.table_name AS to_table,
            ccu.column_name AS to_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name
    """)
    result = await db.execute(fk_sql)
    relationships = []

    for row in result.fetchall():
        from_table, from_column, to_table, to_column = row

        if module:
            from_mod = _classify_table(from_table)
            to_mod = _classify_table(to_table)
            if from_mod != module and to_mod != module:
                continue

        relationships.append(
            RelationshipInfo(
                from_table=from_table,
                from_column=from_column,
                to_table=to_table,
                to_column=to_column,
                relationship_type="many-to-one",
            )
        )

    return RelationshipsResponse(
        relationships=relationships,
        total=len(relationships),
    )


@router.get("/schema/modules")
async def list_modules(
    db: DBSession,
    user: CurrentUser,
):
    """Return all ERP modules with their table counts."""
    sql = text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name != 'alembic_version'
    """)
    result = await db.execute(sql)
    tables = [row[0] for row in result.fetchall()]

    module_counts: dict[str, int] = {}
    for t in tables:
        mod = _classify_table(t)
        module_counts[mod] = module_counts.get(mod, 0) + 1

    return [
        {"module": mod, "table_count": count}
        for mod, count in sorted(module_counts.items())
    ]


@router.get("/schema/search")
async def search_schema(
    db: DBSession,
    user: CurrentUser,
    q: str = Query(..., min_length=1, description="Search term for tables/columns"),
):
    """Search tables and columns by name. Powers the schema browser autocomplete."""
    search_term = f"%{q.lower()}%"

    # Search tables
    tables_sql = text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND LOWER(table_name) LIKE :q
        ORDER BY table_name
        LIMIT 20
    """)
    tables_result = await db.execute(tables_sql, {"q": search_term})
    matching_tables = [{"type": "table", "name": row[0], "module": _classify_table(row[0])} for row in tables_result.fetchall()]

    # Search columns
    columns_sql = text("""
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND LOWER(column_name) LIKE :q
        ORDER BY table_name, column_name
        LIMIT 30
    """)
    columns_result = await db.execute(columns_sql, {"q": search_term})
    matching_columns = [
        {"type": "column", "table": row[0], "name": row[1], "data_type": row[2], "module": _classify_table(row[0])}
        for row in columns_result.fetchall()
    ]

    return {
        "tables": matching_tables,
        "columns": matching_columns,
        "total": len(matching_tables) + len(matching_columns),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Copilot Q&A Endpoint
# ═══════════════════════════════════════════════════════════════════════════════

class CopilotQuery(BaseModel):
    question: str
    module: str | None = None


@router.post("/copilot/query")
async def copilot_ask(
    body: CopilotQuery,
    db: DBSession,
    user: CurrentUser,
):
    """Natural language query — ask anything about your ERP data.

    Converts the question to SQL via LLM, executes it read-only,
    and returns data + AI-generated narrative + chart suggestions.
    """
    from app.services.analytics_copilot import copilot_query

    result = await copilot_query(body.question, db, body.module)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# Semantic Model Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/semantic-models")
async def list_semantic_models(
    db: DBSession,
    user: CurrentUser,
    module: str | None = Query(None),
):
    """List all semantic models, optionally filtered by module."""
    from sqlalchemy import select
    from app.models.analytics import SemanticModel

    stmt = select(SemanticModel)
    if module:
        stmt = stmt.where(SemanticModel.module == module)
    stmt = stmt.order_by(SemanticModel.module)

    result = await db.execute(stmt)
    models = result.scalars().all()

    return [
        {
            "id": str(m.id),
            "name": m.name,
            "description": m.description,
            "module": m.module,
            "table_count": len(m.tables) if isinstance(m.tables, dict) else 0,
            "measure_count": len(m.measures) if isinstance(m.measures, list) else 0,
            "is_system": m.is_system,
            "created_at": m.created_at.isoformat(),
        }
        for m in models
    ]


@router.post("/semantic-models/generate")
async def generate_models(
    db: DBSession,
    user: CurrentUser,
):
    """Auto-generate semantic models for all ERP modules."""
    from app.services.analytics_modeling import generate_all_models

    models = await generate_all_models(db)
    return {
        "generated": len(models),
        "modules": [m.module for m in models],
    }


@router.post("/semantic-models/{module}/refresh")
async def refresh_model(
    module: str,
    db: DBSession,
    user: CurrentUser,
):
    """Re-generate the semantic model for a specific module."""
    from app.services.analytics_modeling import refresh_model as do_refresh

    model = await do_refresh(db, module)
    return {
        "id": str(model.id),
        "name": model.name,
        "module": model.module,
        "table_count": len(model.tables) if isinstance(model.tables, dict) else 0,
        "measure_count": len(model.measures) if isinstance(model.measures, list) else 0,
    }


@router.get("/semantic-models/{model_id}")
async def get_semantic_model(
    model_id: str,
    db: DBSession,
    user: CurrentUser,
):
    """Get full details of a semantic model."""
    from sqlalchemy import select
    from app.models.analytics import SemanticModel
    from fastapi import HTTPException, status

    result = await db.execute(
        select(SemanticModel).where(SemanticModel.id == model_id)
    )
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semantic model not found")

    return {
        "id": str(model.id),
        "name": model.name,
        "description": model.description,
        "module": model.module,
        "tables": model.tables,
        "relationships": model.relationships,
        "measures": model.measures,
        "calculated_columns": model.calculated_columns,
        "is_system": model.is_system,
        "created_at": model.created_at.isoformat(),
        "updated_at": model.updated_at.isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DashboardBookmark Endpoints — save/restore filter states
# ═══════════════════════════════════════════════════════════════════════════════

import uuid as _uuid  # noqa: E402 — needed only in this section
from fastapi import HTTPException, status as _status  # noqa: E402
from sqlalchemy import select as _select  # noqa: E402


class BookmarkCreate(BaseModel):
    name: str
    filter_state: dict = {}
    visual_states: dict = {}
    is_default: bool = False


@router.get("/dashboards/{dashboard_id}/bookmarks")
async def list_bookmarks(
    dashboard_id: str,
    db: DBSession,
    user: CurrentUser,
):
    """List all bookmarks for a dashboard."""
    from app.models.analytics import DashboardBookmark

    result = await db.execute(
        _select(DashboardBookmark)
        .where(DashboardBookmark.dashboard_id == _uuid.UUID(dashboard_id))
        .order_by(DashboardBookmark.is_default.desc(), DashboardBookmark.created_at.asc())
    )
    bookmarks = result.scalars().all()
    return [
        {
            "id": str(b.id),
            "name": b.name,
            "filter_state": b.filter_state,
            "visual_states": b.visual_states,
            "is_default": b.is_default,
            "created_at": b.created_at.isoformat(),
        }
        for b in bookmarks
    ]


@router.post("/dashboards/{dashboard_id}/bookmarks")
async def create_bookmark(
    dashboard_id: str,
    body: BookmarkCreate,
    db: DBSession,
    user: CurrentUser,
):
    """Save current filter/visual state as a named bookmark."""
    from app.models.analytics import DashboardBookmark

    # If this is the new default, clear other defaults
    if body.is_default:
        existing = await db.execute(
            _select(DashboardBookmark)
            .where(DashboardBookmark.dashboard_id == _uuid.UUID(dashboard_id))
            .where(DashboardBookmark.is_default == True)  # noqa: E712
        )
        for bm in existing.scalars().all():
            bm.is_default = False

    bookmark = DashboardBookmark(
        dashboard_id=_uuid.UUID(dashboard_id),
        name=body.name,
        filter_state=body.filter_state,
        visual_states=body.visual_states,
        is_default=body.is_default,
    )
    db.add(bookmark)
    await db.commit()
    await db.refresh(bookmark)

    return {
        "id": str(bookmark.id),
        "name": bookmark.name,
        "filter_state": bookmark.filter_state,
        "visual_states": bookmark.visual_states,
        "is_default": bookmark.is_default,
        "created_at": bookmark.created_at.isoformat(),
    }


@router.delete("/dashboards/{dashboard_id}/bookmarks/{bookmark_id}", status_code=204)
async def delete_bookmark(
    dashboard_id: str,
    bookmark_id: str,
    db: DBSession,
    user: CurrentUser,
):
    """Delete a bookmark."""
    from app.models.analytics import DashboardBookmark

    result = await db.execute(
        _select(DashboardBookmark).where(
            DashboardBookmark.id == _uuid.UUID(bookmark_id),
            DashboardBookmark.dashboard_id == _uuid.UUID(dashboard_id),
        )
    )
    bookmark = result.scalar_one_or_none()
    if not bookmark:
        raise HTTPException(status_code=_status.HTTP_404_NOT_FOUND, detail="Bookmark not found")

    await db.delete(bookmark)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# E. DashboardShare CRUD
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/dashboards/{dashboard_id}/shares")
async def create_share(dashboard_id: str, payload: dict, db: DBSession, user: CurrentUser):
    from app.models.analytics import DashboardShare
    share = DashboardShare(
        dashboard_id=dashboard_id,
        shared_with_user_id=payload.get("user_id"),
        shared_with_role=payload.get("role"),
        is_public=payload.get("is_public", False),
        permission=payload.get("permission", "view"),
        created_by=str(user.id),
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)
    return share


@router.get("/dashboards/{dashboard_id}/shares")
async def list_shares(dashboard_id: str, db: DBSession, user: CurrentUser):
    from app.models.analytics import DashboardShare
    from sqlalchemy import select
    result = await db.execute(select(DashboardShare).where(DashboardShare.dashboard_id == dashboard_id))
    return result.scalars().all()


@router.delete("/dashboards/{dashboard_id}/shares/{share_id}")
async def delete_share(dashboard_id: str, share_id: str, db: DBSession, user: CurrentUser):
    from app.models.analytics import DashboardShare
    from sqlalchemy import select
    result = await db.execute(select(DashboardShare).where(DashboardShare.id == share_id))
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    await db.delete(share)
    await db.commit()
    return {"deleted": True}


# ═══════════════════════════════════════════════════════════════════════════════
# F. Embed token endpoints
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/embed/tokens")
async def create_embed_token(payload: dict, db: DBSession, user: CurrentUser):
    from app.models.analytics import EmbedToken
    t = EmbedToken(
        dashboard_id=payload["dashboard_id"],
        name=payload.get("name", "Embed Token"),
        created_by=str(user.id),
        allowed_origins=payload.get("allowed_origins"),
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return t


@router.get("/embed/tokens")
async def list_embed_tokens(db: DBSession, user: CurrentUser):
    from app.models.analytics import EmbedToken
    from sqlalchemy import select
    result = await db.execute(select(EmbedToken).where(EmbedToken.created_by == str(user.id)))
    return result.scalars().all()


@router.get("/embed/{token}", include_in_schema=False)
async def get_embed_dashboard(token: str, db: DBSession):
    from app.models.analytics import EmbedToken, Dashboard
    from sqlalchemy import select
    from datetime import datetime, timezone
    result = await db.execute(
        select(EmbedToken).where(EmbedToken.token == token, EmbedToken.is_active == True)  # noqa: E712
    )
    token_obj = result.scalar_one_or_none()
    if not token_obj:
        raise HTTPException(status_code=404, detail="Invalid embed token")
    if token_obj.expires_at and token_obj.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=403, detail="Token expired")
    token_obj.last_used_at = datetime.now(timezone.utc)
    token_obj.view_count = (token_obj.view_count or 0) + 1
    await db.commit()
    dash_r = await db.execute(select(Dashboard).where(Dashboard.id == token_obj.dashboard_id))
    dashboard = dash_r.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return {"token": token, "dashboard": dashboard, "embed_mode": True}


@router.delete("/embed/tokens/{token_id}")
async def delete_embed_token(token_id: str, db: DBSession, user: CurrentUser):
    from app.models.analytics import EmbedToken
    from sqlalchemy import select
    result = await db.execute(select(EmbedToken).where(EmbedToken.id == token_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Token not found")
    await db.delete(t)
    await db.commit()
    return {"deleted": True}


# ═══════════════════════════════════════════════════════════════════════════════
# G. Compliance reports
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/compliance/kra-itax")
async def kra_itax_report(
    db: DBSession,
    user: CurrentUser,
    year: int = Query(default=None),
):
    from sqlalchemy import text
    from datetime import datetime
    if not year:
        year = datetime.now().year
    try:
        r = await db.execute(
            text("""
                SELECT
                    COALESCE(u.full_name, u.email) as employee_name,
                    u.id as employee_id,
                    SUM(CASE WHEN je.entry_type='payroll_paye' THEN je.amount ELSE 0 END) as paye_total,
                    SUM(CASE WHEN je.entry_type='payroll_gross' THEN je.amount ELSE 0 END) as gross_pay
                FROM journal_entries je
                JOIN users u ON je.reference_id=u.id::text
                WHERE EXTRACT(YEAR FROM je.entry_date)=:year
                  AND je.entry_type IN ('payroll_paye','payroll_gross')
                GROUP BY u.id, u.full_name, u.email
                ORDER BY u.full_name
            """),
            {"year": year},
        )
        rows = [dict(x) for x in r.mappings().all()]
    except Exception:
        rows = []
    return {
        "report_type": "kra_itax",
        "tax_year": year,
        "generated_at": datetime.now().isoformat(),
        "records": rows,
        "total_records": len(rows),
    }


@router.get("/compliance/nhif-nssf")
async def nhif_nssf_report(
    db: DBSession,
    user: CurrentUser,
    year: int = Query(default=None),
    month: int = Query(default=None),
):
    from sqlalchemy import text
    from datetime import datetime
    if not year:
        year = datetime.now().year
    if not month:
        month = datetime.now().month
    try:
        r = await db.execute(
            text("""
                SELECT
                    COALESCE(u.full_name, u.email) as employee_name,
                    u.id as employee_id,
                    SUM(CASE WHEN je.entry_type='payroll_nhif' THEN je.amount ELSE 0 END) as nhif_contribution,
                    SUM(CASE WHEN je.entry_type='payroll_nssf' THEN je.amount ELSE 0 END) as nssf_contribution
                FROM journal_entries je
                JOIN users u ON je.reference_id=u.id::text
                WHERE EXTRACT(YEAR FROM je.entry_date)=:year
                  AND EXTRACT(MONTH FROM je.entry_date)=:month
                  AND je.entry_type IN ('payroll_nhif','payroll_nssf')
                GROUP BY u.id, u.full_name, u.email
                ORDER BY u.full_name
            """),
            {"year": year, "month": month},
        )
        rows = [dict(x) for x in r.mappings().all()]
    except Exception:
        rows = []
    return {
        "report_type": "nhif_nssf",
        "period": f"{year}-{month:02d}",
        "generated_at": datetime.now().isoformat(),
        "records": rows,
    }


@router.get("/compliance/vat-return")
async def vat_return_report(
    db: DBSession,
    user: CurrentUser,
    year: int = Query(default=None),
    quarter: int = Query(default=None),
):
    from sqlalchemy import text
    from datetime import datetime
    if not year:
        year = datetime.now().year
    if not quarter:
        quarter = (datetime.now().month - 1) // 3 + 1
    try:
        r = await db.execute(
            text("""
                SELECT
                    SUM(vat_amount) as total_output_vat,
                    SUM(subtotal) as total_taxable_sales,
                    COUNT(*) as invoice_count
                FROM invoices
                WHERE EXTRACT(YEAR FROM issue_date)=:year
                  AND EXTRACT(QUARTER FROM issue_date)=:quarter
                  AND status NOT IN ('cancelled','draft')
            """),
            {"year": year, "quarter": quarter},
        )
        summary = r.mappings().first()
    except Exception:
        summary = None
    return {
        "report_type": "vat_return",
        "year": year,
        "quarter": quarter,
        "period": f"Q{quarter} {year}",
        "generated_at": datetime.now().isoformat(),
        "summary": dict(summary) if summary else {
            "total_output_vat": 0,
            "total_taxable_sales": 0,
            "invoice_count": 0,
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# H. What-If Simulator
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/whatif/simulate")
async def whatif_simulate(payload: dict, db: DBSession, user: CurrentUser):
    from sqlalchemy import text
    base_metric = payload.get("base_metric", "revenue")
    METRIC_QUERIES = {
        "revenue": "SELECT COALESCE(SUM(total_amount),0) as value FROM invoices WHERE status='paid'",
        "expenses": "SELECT COALESCE(SUM(amount),0) as value FROM journal_entries WHERE entry_type LIKE 'expense%'",
        "headcount": "SELECT COUNT(*) as value FROM employees WHERE status='active'",
        "deals": "SELECT COALESCE(SUM(value),0) as value FROM deals WHERE status='won'",
    }
    base_value = 0.0
    if base_metric in METRIC_QUERIES:
        try:
            r = await db.execute(text(METRIC_QUERIES[base_metric]))
            row = r.mappings().first()
            base_value = float(row["value"] or 0) if row else 0.0
        except Exception:
            pass
    results = []
    for s in payload.get("scenarios", []):
        ct = s.get("change_type", "pct")
        cv = float(s.get("change_value", 0))
        if ct == "pct":
            proj = base_value * (1 + cv / 100)
        elif ct == "abs":
            proj = base_value + cv
        else:
            proj = cv
        delta = proj - base_value
        results.append({
            "scenario": s.get("name", "Scenario"),
            "base_value": base_value,
            "projected_value": proj,
            "delta": delta,
            "delta_pct": round((delta / base_value * 100) if base_value else 0, 2),
            "parameter": s.get("parameter", ""),
            "change_type": ct,
            "change_value": cv,
        })
    return {"base_metric": base_metric, "base_value": base_value, "scenarios": results}
