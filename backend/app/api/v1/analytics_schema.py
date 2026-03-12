"""Analytics Schema Introspection API — zero-config data connectivity.

Exposes the full ERP database schema (tables, columns, types, foreign keys)
grouped by module, enabling the dashboard builder and copilot to auto-discover
all available data sources without manual configuration.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Query
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
