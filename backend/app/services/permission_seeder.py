"""Idempotent permission + system-role seeder.

Called once during application startup (lifespan in main.py).
All operations are INSERT-if-not-exists — safe to run on every start.
"""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Permission, Role, RolePermission

logger = logging.getLogger(__name__)

# ── Permission manifest ────────────────────────────────────────────────────────
# Format: (name, description, app_scope)
# Actions per module: view, create, edit, delete, approve, export
# Some modules have extra domain-specific actions.

_PERMISSIONS: list[tuple[str, str, str]] = [
    # Finance
    ("finance:view",            "View financial records",           "finance"),
    ("finance:create",          "Create invoices and transactions",  "finance"),
    ("finance:edit",            "Edit financial records",           "finance"),
    ("finance:delete",          "Delete financial records",         "finance"),
    ("finance:approve",         "Approve financial transactions",   "finance"),
    ("finance:export",          "Export financial reports",         "finance"),
    # HR
    ("hr:view",                 "View HR records",                  "hr"),
    ("hr:create",               "Create HR records",               "hr"),
    ("hr:edit",                 "Edit HR records",                 "hr"),
    ("hr:delete",               "Delete HR records",               "hr"),
    ("hr:approve",              "Approve leave / contracts",        "hr"),
    ("hr:export",               "Export HR reports",               "hr"),
    ("hr:view_payroll",         "View payroll data",               "hr"),
    ("hr:manage_payroll",       "Process payroll",                 "hr"),
    # CRM
    ("crm:view",                "View CRM data",                   "crm"),
    ("crm:create",              "Create leads and contacts",       "crm"),
    ("crm:edit",                "Edit CRM records",                "crm"),
    ("crm:delete",              "Delete CRM records",              "crm"),
    ("crm:approve",             "Approve deals",                   "crm"),
    ("crm:export",              "Export CRM reports",              "crm"),
    # Projects
    ("projects:view",           "View projects",                   "projects"),
    ("projects:create",         "Create projects and tasks",       "projects"),
    ("projects:edit",           "Edit projects and tasks",         "projects"),
    ("projects:delete",         "Delete projects and tasks",       "projects"),
    ("projects:approve",        "Approve project milestones",      "projects"),
    ("projects:export",         "Export project reports",          "projects"),
    # Inventory
    ("inventory:view",          "View inventory",                  "inventory"),
    ("inventory:create",        "Add inventory items",             "inventory"),
    ("inventory:edit",          "Edit inventory items",            "inventory"),
    ("inventory:delete",        "Delete inventory items",          "inventory"),
    ("inventory:approve",       "Approve stock adjustments",       "inventory"),
    ("inventory:export",        "Export inventory reports",        "inventory"),
    # Supply Chain
    ("supply_chain:view",       "View supply chain records",       "supply_chain"),
    ("supply_chain:create",     "Create purchase orders",          "supply_chain"),
    ("supply_chain:edit",       "Edit supply chain records",       "supply_chain"),
    ("supply_chain:delete",     "Delete supply chain records",     "supply_chain"),
    ("supply_chain:approve",    "Approve purchase orders",         "supply_chain"),
    ("supply_chain:export",     "Export supply chain reports",     "supply_chain"),
    # Manufacturing
    ("manufacturing:view",      "View manufacturing records",      "manufacturing"),
    ("manufacturing:create",    "Create production orders",        "manufacturing"),
    ("manufacturing:edit",      "Edit manufacturing records",      "manufacturing"),
    ("manufacturing:delete",    "Delete manufacturing records",    "manufacturing"),
    ("manufacturing:approve",   "Approve production runs",         "manufacturing"),
    ("manufacturing:export",    "Export manufacturing reports",    "manufacturing"),
    # POS
    ("pos:view",                "View POS transactions",           "pos"),
    ("pos:create",              "Create POS transactions",         "pos"),
    ("pos:edit",                "Edit POS transactions",           "pos"),
    ("pos:delete",              "Delete POS transactions",         "pos"),
    ("pos:export",              "Export POS reports",              "pos"),
    # E-Commerce
    ("ecommerce:view",          "View e-commerce data",            "ecommerce"),
    ("ecommerce:create",        "Create products and orders",      "ecommerce"),
    ("ecommerce:edit",          "Edit e-commerce records",         "ecommerce"),
    ("ecommerce:delete",        "Delete e-commerce records",       "ecommerce"),
    ("ecommerce:approve",       "Approve e-commerce orders",       "ecommerce"),
    ("ecommerce:export",        "Export e-commerce reports",       "ecommerce"),
    # Support
    ("support:view",            "View support tickets",            "support"),
    ("support:create",          "Create support tickets",          "support"),
    ("support:edit",            "Edit support tickets",            "support"),
    ("support:delete",          "Delete support tickets",          "support"),
    ("support:approve",         "Close / escalate tickets",        "support"),
    ("support:export",          "Export support reports",          "support"),
    # Analytics
    ("analytics:view",          "View analytics dashboards",       "analytics"),
    ("analytics:export",        "Export analytics data",           "analytics"),
    ("analytics:configure",     "Configure analytics dashboards",  "analytics"),
    # Mail
    ("mail:view",               "View mail",                       "mail"),
    ("mail:send",               "Send mail",                       "mail"),
    ("mail:delete",             "Delete mail",                     "mail"),
    # Calendar
    ("calendar:view",           "View calendar events",            "calendar"),
    ("calendar:create",         "Create calendar events",          "calendar"),
    ("calendar:edit",           "Edit calendar events",            "calendar"),
    ("calendar:delete",         "Delete calendar events",          "calendar"),
    # Drive
    ("drive:view",              "View drive files",                "drive"),
    ("drive:upload",            "Upload files to drive",           "drive"),
    ("drive:edit",              "Edit drive files",                "drive"),
    ("drive:delete",            "Delete drive files",              "drive"),
    ("drive:share",             "Share drive files",               "drive"),
    # Docs
    ("docs:view",               "View documents",                  "docs"),
    ("docs:create",             "Create documents",                "docs"),
    ("docs:edit",               "Edit documents",                  "docs"),
    ("docs:delete",             "Delete documents",                "docs"),
    # Notes
    ("notes:view",              "View notes",                      "notes"),
    ("notes:create",            "Create notes",                    "notes"),
    ("notes:edit",              "Edit notes",                      "notes"),
    ("notes:delete",            "Delete notes",                    "notes"),
    # Forms
    ("forms:view",              "View forms",                      "forms"),
    ("forms:create",            "Create forms",                    "forms"),
    ("forms:edit",              "Edit forms",                      "forms"),
    ("forms:delete",            "Delete forms",                    "forms"),
    ("forms:export",            "Export form responses",           "forms"),
    # Teams / Video
    ("teams:view",              "View team meetings",              "teams"),
    ("teams:create",            "Create team meetings",            "teams"),
    ("teams:manage",            "Manage team settings",            "teams"),
    # KDS
    ("kds:view",                "View kitchen display",            "kds"),
    ("kds:manage",              "Manage KDS configuration",        "kds"),
    # Loyalty
    ("loyalty:view",            "View loyalty program",            "loyalty"),
    ("loyalty:create",          "Create loyalty rewards",          "loyalty"),
    ("loyalty:manage",          "Manage loyalty program",          "loyalty"),
]

# ── System-role permission map ─────────────────────────────────────────────────
# Key = role name, value = list of permission name prefixes to include.
# "*" means all permissions.

_ALL_VIEW = [p[0] for p in _PERMISSIONS if p[0].endswith(":view")]
_ALL_CREATE_EDIT = [p[0] for p in _PERMISSIONS if p[0].endswith((":create", ":edit"))]
_ALL_APPROVE = [p[0] for p in _PERMISSIONS if p[0].endswith(":approve")]

_SYSTEM_ROLES: list[dict] = [
    {
        "name": "super_admin",
        "description": "Full system access — all permissions",
        "is_system": True,
        "permissions": [p[0] for p in _PERMISSIONS],
    },
    {
        "name": "manager",
        "description": "Senior staff — view, create, edit and approve access across all modules",
        "is_system": True,
        "permissions": _ALL_VIEW + _ALL_CREATE_EDIT + _ALL_APPROVE,
    },
    {
        "name": "staff",
        "description": "Standard user — view, create, and edit assigned modules",
        "is_system": True,
        "permissions": _ALL_VIEW + _ALL_CREATE_EDIT,
    },
    {
        "name": "viewer",
        "description": "Read-only access to all modules",
        "is_system": True,
        "permissions": _ALL_VIEW,
    },
    {
        "name": "finance_admin",
        "description": "Finance department head — full finance access plus approval rights",
        "is_system": True,
        "app_scope": "finance",
        "permissions": [p[0] for p in _PERMISSIONS if p[2] == "finance"],
    },
]


async def seed_permissions(db: AsyncSession) -> None:
    """Upsert all permissions and system roles. Idempotent — safe on every startup."""
    total_perms = 0
    total_roles = 0

    # 1. Ensure all permissions exist
    perm_map: dict[str, Permission] = {}
    for name, description, app_scope in _PERMISSIONS:
        result = await db.execute(select(Permission).where(Permission.name == name))
        perm = result.scalar_one_or_none()
        if perm is None:
            perm = Permission(name=name, description=description, app_scope=app_scope)
            db.add(perm)
            total_perms += 1
        perm_map[name] = perm

    await db.flush()  # assigns IDs

    # 2. Ensure all system roles exist and have their permissions
    for role_def in _SYSTEM_ROLES:
        result = await db.execute(select(Role).where(Role.name == role_def["name"]))
        role = result.scalar_one_or_none()
        if role is None:
            role = Role(
                name=role_def["name"],
                description=role_def["description"],
                is_system=True,
                app_scope=role_def.get("app_scope"),
            )
            db.add(role)
            total_roles += 1

        await db.flush()  # ensure role.id is set

        # Assign permissions (idempotent)
        for perm_name in role_def["permissions"]:
            perm = perm_map.get(perm_name)
            if perm is None:
                continue
            existing = await db.execute(
                select(RolePermission).where(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == perm.id,
                )
            )
            if existing.scalar_one_or_none() is None:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    await db.flush()

    if total_perms or total_roles:
        logger.info(
            "Permission seeder: added %d permissions and %d system roles.",
            total_perms,
            total_roles,
        )
    else:
        logger.debug("Permission seeder: nothing new to seed.")
