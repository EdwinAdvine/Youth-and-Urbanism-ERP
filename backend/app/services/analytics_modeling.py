"""Auto-generate semantic models from SQLAlchemy model introspection.

On startup (or on demand), inspects all ERP models and builds SemanticModel
records with pre-configured tables, relationships, and common measures.
Zero-config: every module gets a data model automatically.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import SemanticModel
from app.models.base import Base

logger = logging.getLogger(__name__)

# ── Module → model table prefix mapping ──────────────────────────────────────
_MODULE_CONFIG: dict[str, dict[str, Any]] = {
    "finance": {
        "prefixes": ["finance_", "journal_"],
        "label": "Finance & Accounting",
        "default_measures": [
            {"name": "total_revenue", "expression": "SUM(finance_invoices.total)", "description": "Sum of all paid invoices"},
            {"name": "total_expenses", "expression": "SUM(journal_entries.amount) FILTER (WHERE journal_entries.entry_type = 'expense')", "description": "Total expenses"},
            {"name": "outstanding_invoices", "expression": "COUNT(*) FILTER (WHERE finance_invoices.status = 'sent')", "description": "Count of unpaid invoices"},
            {"name": "net_profit", "expression": "SUM(CASE WHEN type='revenue' THEN amount ELSE -amount END)", "description": "Revenue minus expenses"},
        ],
    },
    "hr": {
        "prefixes": ["hr_", "employees", "departments", "payroll_"],
        "label": "Human Resources",
        "default_measures": [
            {"name": "headcount", "expression": "COUNT(DISTINCT employees.id)", "description": "Total active employees"},
            {"name": "avg_salary", "expression": "AVG(employees.salary)", "description": "Average employee salary"},
            {"name": "attrition_rate", "expression": "COUNT(*) FILTER (WHERE employees.status = 'terminated') * 100.0 / NULLIF(COUNT(*), 0)", "description": "Employee attrition percentage"},
        ],
    },
    "crm": {
        "prefixes": ["crm_", "contacts", "deals", "pipelines"],
        "label": "CRM & Sales",
        "default_measures": [
            {"name": "total_contacts", "expression": "COUNT(contacts.id)", "description": "Total CRM contacts"},
            {"name": "pipeline_value", "expression": "SUM(deals.amount)", "description": "Total deal pipeline value"},
            {"name": "conversion_rate", "expression": "COUNT(*) FILTER (WHERE deals.stage = 'won') * 100.0 / NULLIF(COUNT(*), 0)", "description": "Deal win rate"},
            {"name": "deals_won", "expression": "COUNT(*) FILTER (WHERE deals.stage = 'won')", "description": "Number of won deals"},
        ],
    },
    "projects": {
        "prefixes": ["projects", "project_"],
        "label": "Project Management",
        "default_measures": [
            {"name": "active_projects", "expression": "COUNT(*) FILTER (WHERE projects.status = 'active')", "description": "Currently active projects"},
            {"name": "completion_rate", "expression": "COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / NULLIF(COUNT(*), 0)", "description": "Project completion rate"},
            {"name": "overdue_tasks", "expression": "COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'completed')", "description": "Tasks past due date"},
        ],
    },
    "inventory": {
        "prefixes": ["inventory_", "stock_", "products", "warehouses"],
        "label": "Inventory & Stock",
        "default_measures": [
            {"name": "total_products", "expression": "COUNT(DISTINCT products.id)", "description": "Total product SKUs"},
            {"name": "stock_value", "expression": "SUM(quantity * unit_cost)", "description": "Total inventory valuation"},
            {"name": "low_stock_items", "expression": "COUNT(*) FILTER (WHERE quantity <= reorder_point)", "description": "Items below reorder point"},
        ],
    },
    "support": {
        "prefixes": ["support_"],
        "label": "Support & Helpdesk",
        "default_measures": [
            {"name": "open_tickets", "expression": "COUNT(*) FILTER (WHERE status = 'open')", "description": "Currently open tickets"},
            {"name": "avg_resolution_time", "expression": "AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)", "description": "Average resolution time (hours)"},
            {"name": "satisfaction_score", "expression": "AVG(satisfaction_rating)", "description": "Average customer satisfaction"},
        ],
    },
    "ecommerce": {
        "prefixes": ["ecommerce_", "orders", "carts"],
        "label": "E-Commerce",
        "default_measures": [
            {"name": "total_orders", "expression": "COUNT(orders.id)", "description": "Total orders placed"},
            {"name": "total_gmv", "expression": "SUM(orders.total)", "description": "Gross merchandise value"},
            {"name": "avg_order_value", "expression": "AVG(orders.total)", "description": "Average order value"},
        ],
    },
}


async def discover_tables(db: AsyncSession, module: str) -> dict[str, list[dict]]:
    """Discover all tables for a module by querying information_schema."""
    config = _MODULE_CONFIG.get(module, {"prefixes": [module + "_"]})
    prefixes = config["prefixes"]

    # Build WHERE clause for table name matching
    conditions = " OR ".join(
        f"table_name LIKE '{p}%'" if p.endswith("_") else f"table_name = '{p}'"
        for p in prefixes
    )

    sql = text(f"""
        SELECT
            c.table_name,
            c.column_name,
            c.data_type,
            c.is_nullable
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND ({conditions})
        ORDER BY c.table_name, c.ordinal_position
    """)  # noqa: S608

    result = await db.execute(sql)
    tables: dict[str, list[dict]] = {}
    for row in result.fetchall():
        tables.setdefault(row[0], []).append({
            "name": row[1],
            "type": row[2],
            "nullable": row[3] == "YES",
        })

    return tables


async def discover_relationships(db: AsyncSession, tables: list[str]) -> list[dict]:
    """Discover FK relationships between the given tables."""
    if not tables:
        return []

    placeholders = ", ".join(f"'{t}'" for t in tables)
    sql = text(f"""
        SELECT
            tc.table_name AS from_table,
            kcu.column_name AS from_column,
            ccu.table_name AS to_table,
            ccu.column_name AS to_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND (tc.table_name IN ({placeholders}) OR ccu.table_name IN ({placeholders}))
    """)  # noqa: S608

    result = await db.execute(sql)
    return [
        {
            "from_table": row[0],
            "from_column": row[1],
            "to_table": row[2],
            "to_column": row[3],
            "type": "many-to-one",
        }
        for row in result.fetchall()
    ]


async def generate_semantic_model(db: AsyncSession, module: str) -> SemanticModel:
    """Auto-generate a semantic model for a module from the live database schema."""
    config = _MODULE_CONFIG.get(module, {})
    label = config.get("label", module.title())
    default_measures = config.get("default_measures", [])

    # Discover tables and their columns
    tables = await discover_tables(db, module)
    table_names = list(tables.keys())

    # Discover relationships
    relationships = await discover_relationships(db, table_names)

    # Build the semantic model
    model = SemanticModel(
        name=f"{label} Data Model",
        description=f"Auto-generated semantic model for {label}. Contains {len(table_names)} tables with {sum(len(cols) for cols in tables.values())} columns.",
        module=module,
        tables={
            name: {
                "columns": cols,
                "label": name.replace("_", " ").title(),
            }
            for name, cols in tables.items()
        },
        relationships={"links": relationships},
        measures=default_measures,
        calculated_columns=[],
        is_system=True,
        owner_id=None,
    )

    return model


async def generate_all_models(db: AsyncSession) -> list[SemanticModel]:
    """Generate semantic models for all configured ERP modules.

    Skips modules that already have a system-generated model.
    """
    existing = await db.execute(
        select(SemanticModel.module).where(SemanticModel.is_system == True)  # noqa: E712
    )
    existing_modules = {row[0] for row in existing.fetchall()}

    models = []
    for module in _MODULE_CONFIG:
        if module in existing_modules:
            logger.info("Semantic model for '%s' already exists, skipping", module)
            continue

        try:
            model = await generate_semantic_model(db, module)
            db.add(model)
            models.append(model)
            logger.info("Generated semantic model for '%s' (%d tables)", module, len(model.tables))
        except Exception:
            logger.exception("Failed to generate semantic model for '%s'", module)

    if models:
        await db.flush()
        logger.info("Generated %d new semantic models", len(models))

    return models


async def refresh_model(db: AsyncSession, module: str) -> SemanticModel:
    """Re-generate a semantic model for a specific module (replaces existing)."""
    # Delete existing system model
    existing = await db.execute(
        select(SemanticModel).where(
            SemanticModel.module == module,
            SemanticModel.is_system == True,  # noqa: E712
        )
    )
    old = existing.scalar_one_or_none()
    if old:
        await db.delete(old)
        await db.flush()

    model = await generate_semantic_model(db, module)
    db.add(model)
    await db.flush()
    return model
