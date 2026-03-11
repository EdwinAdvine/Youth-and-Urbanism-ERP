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
from app.api.v1 import crm_ext
from app.api.v1 import hr_ext
from app.api.v1 import inventory_ext
from app.api.v1 import pos_ext
from app.api.v1 import ecommerce_ext
from app.api.v1 import analytics_ext
from app.api.v1 import finance_recurring
from app.api.v1 import finance_expenses
from app.api.v1 import finance_vendor_bills
from app.api.v1 import finance_assets
from app.api.v1 import finance_reports_ext
from app.api.v1 import supplychain_ext as supplychain_ext_mod
from app.api.v1 import manufacturing_ext as manufacturing_ext_mod
from app.api.v1 import projects_ext as projects_ext_mod
from app.api.v1 import mail_ext as mail_ext_mod
from app.api.v1 import support_ext as support_ext_mod
from app.api.v1 import calendar_ext as calendar_ext_mod
from app.api.v1 import docs_ext as docs_ext_mod
from app.api.v1 import meetings_ext as meetings_ext_mod
from app.api.v1 import notes_ext as notes_ext_mod
from app.api.v1 import forms_ext as forms_ext_mod
from app.api.v1 import ai_ext as ai_ext_mod
from app.api.v1 import drive_ext as drive_ext_mod
from app.api.v1 import finance_currencies
from app.api.v1 import crm_tickets
from app.api.v1 import mail_filters
from app.api.v1 import admin_mail
from app.api.v1 import admin_drive
from app.api.v1 import admin_docs
from app.api.v1 import admin_meetings
from app.api.v1 import ai_features as ai_features_mod
from app.api.v1 import crm_links
from app.api.v1 import projects_integrations as projects_integrations_mod
from app.api.v1 import cross_module_links as cross_module_links_mod
from app.api.v1 import admin_mail_dns
from app.api.v1 import agent as agent_mod

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
api_router.include_router(crm_ext.router, prefix="/crm", tags=["CRM Extensions"])
api_router.include_router(hr_ext.router, prefix="/hr", tags=["HR Extensions"])
api_router.include_router(inventory_ext.router, prefix="/inventory", tags=["Inventory Extensions"])
api_router.include_router(pos_ext.router, prefix="/pos", tags=["POS Extensions"])
api_router.include_router(ecommerce_ext.router, prefix="/ecommerce", tags=["E-Commerce Extensions"])
api_router.include_router(analytics_ext.router, prefix="/analytics", tags=["Analytics Extensions"])
api_router.include_router(finance_recurring.router, prefix="/finance", tags=["Finance Recurring"])
api_router.include_router(finance_expenses.router, prefix="/finance", tags=["Finance Expenses"])
api_router.include_router(finance_vendor_bills.router, prefix="/finance", tags=["Finance Vendor Bills"])
api_router.include_router(finance_assets.router, prefix="/finance", tags=["Finance Assets"])
api_router.include_router(finance_reports_ext.router, prefix="/finance", tags=["Finance Reports Extended"])
api_router.include_router(supplychain_ext_mod.router, prefix="/supply-chain", tags=["Supply Chain Extensions"])
api_router.include_router(manufacturing_ext_mod.router, prefix="/manufacturing", tags=["Manufacturing Extensions"])
api_router.include_router(projects_ext_mod.router, prefix="/projects", tags=["Projects Extensions"])
api_router.include_router(mail_ext_mod.router, prefix="/mail", tags=["Mail Extensions"])
api_router.include_router(support_ext_mod.router, prefix="/support", tags=["Support Extensions"])
api_router.include_router(calendar_ext_mod.router, prefix="/calendar", tags=["Calendar Extensions"])
api_router.include_router(docs_ext_mod.router, prefix="/docs", tags=["Docs Extensions"])
api_router.include_router(meetings_ext_mod.router, prefix="/meetings", tags=["Meetings Extensions"])
api_router.include_router(notes_ext_mod.router, prefix="/notes", tags=["Notes Extensions"])
api_router.include_router(forms_ext_mod.router, prefix="/forms", tags=["Forms Extensions"])
api_router.include_router(ai_ext_mod.router, prefix="/ai", tags=["AI Extensions"])
api_router.include_router(drive_ext_mod.router, prefix="/drive", tags=["Drive Extensions"])
api_router.include_router(finance_currencies.router, prefix="/finance", tags=["Finance Currencies"])
api_router.include_router(crm_tickets.router, prefix="/crm", tags=["CRM Tickets"])
api_router.include_router(mail_filters.router, prefix="/mail", tags=["Mail Filters"])
api_router.include_router(admin_mail.router, prefix="/admin/mail", tags=["Admin Mail Config"])
api_router.include_router(admin_drive.router, prefix="/admin/drive", tags=["Admin Drive Config"])
api_router.include_router(admin_docs.router, prefix="/admin/docs", tags=["Admin Docs Config"])
api_router.include_router(admin_meetings.router, prefix="/admin/meetings", tags=["Admin Meetings Config"])
api_router.include_router(ai_features_mod.router, tags=["AI Features"])
api_router.include_router(crm_links.router, prefix="/crm", tags=["CRM Cross-Module Links"])
api_router.include_router(projects_integrations_mod.router, prefix="/projects", tags=["Projects Integrations"])
api_router.include_router(cross_module_links_mod.router, tags=["Cross-Module Links"])
api_router.include_router(admin_mail_dns.router, prefix="/admin/mail", tags=["Admin Mail DNS"])
api_router.include_router(agent_mod.router, prefix="/agent", tags=["Agent (Urban Bad AI)"])
