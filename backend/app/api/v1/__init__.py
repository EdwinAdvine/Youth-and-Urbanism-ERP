from fastapi import APIRouter
from app.api.v1 import auth, users, roles, admin, ai, app_admin
from app.api.v1 import drive, docs, meetings, notes_router, calendar_router, mail, analytics
from app.api.v1 import forms, projects
from app.api.v1 import finance, hr, crm
from app.api.v1 import dashboard
from app.api.v1 import inventory, search
from app.api.v1 import settings as settings_router, profile as profile_router, notifications as notifications_router
from app.api.v1 import backups
from app.api.v1 import support
from app.api.v1 import supplychain
from app.api.v1 import pos
from app.api.v1 import manufacturing
from app.api.v1 import user_import
from app.api.v1 import license as license_router
from app.api.v1 import sso
from app.api.v1 import ecommerce
from app.api.v1 import storefront
from app.api.v1 import finance_ext
from app.api.v1 import payroll_ext

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(roles.router, prefix="/roles", tags=["roles"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(app_admin.router, prefix="/admin", tags=["App Admin"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(drive.router, prefix="/drive", tags=["Drive"])
api_router.include_router(docs.router, prefix="/docs", tags=["Docs"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["Meetings"])
api_router.include_router(notes_router.router, prefix="/notes", tags=["Notes"])
api_router.include_router(calendar_router.router, prefix="/calendar", tags=["Calendar"])
api_router.include_router(mail.router, prefix="/mail", tags=["Mail"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(forms.router, prefix="/forms", tags=["Forms"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(finance.router, prefix="/finance", tags=["Finance"])
api_router.include_router(hr.router, prefix="/hr", tags=["HR"])
api_router.include_router(crm.router, prefix="/crm", tags=["CRM"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(search.router, prefix="/search", tags=["Search"])
api_router.include_router(settings_router.router, prefix="/settings", tags=["Settings"])
api_router.include_router(profile_router.router, prefix="/profile", tags=["Profile"])
api_router.include_router(notifications_router.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(backups.router, prefix="/backups", tags=["Backups"])
api_router.include_router(support.router, prefix="/support", tags=["Support"])
api_router.include_router(supplychain.router, prefix="/supply-chain", tags=["Supply Chain"])
api_router.include_router(pos.router, prefix="/pos", tags=["POS"])
api_router.include_router(manufacturing.router, prefix="/manufacturing", tags=["Manufacturing"])
api_router.include_router(user_import.router, prefix="/admin", tags=["User Import"])
api_router.include_router(license_router.router, prefix="/license", tags=["License"])
api_router.include_router(sso.router, prefix="/sso", tags=["SSO"])
api_router.include_router(ecommerce.router, prefix="/ecommerce", tags=["E-Commerce"])
api_router.include_router(storefront.router, prefix="/storefront", tags=["Storefront"])
api_router.include_router(finance_ext.router, prefix="/finance", tags=["Finance Extensions"])
api_router.include_router(payroll_ext.router, prefix="/hr", tags=["Payroll Extensions"])
