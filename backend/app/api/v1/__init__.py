from fastapi import APIRouter, Depends
from app.core.deps import require_app_access
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
from app.api.v1 import analytics_schema as analytics_schema_mod
from app.api.v1 import finance_recurring
from app.api.v1 import finance_expenses
from app.api.v1 import finance_vendor_bills
from app.api.v1 import finance_assets
from app.api.v1 import finance_reports_ext
from app.api.v1 import supplychain_planning as supplychain_planning_mod
from app.api.v1 import supplychain_ops as supplychain_ops_mod
from app.api.v1 import supplychain_ext as supplychain_ext_mod
from app.api.v1 import supplychain_logistics as supplychain_logistics_mod
from app.api.v1 import supplychain_risk as supplychain_risk_mod
from app.api.v1 import manufacturing_ext as manufacturing_ext_mod
from app.api.v1 import manufacturing_eco as manufacturing_eco_mod
from app.api.v1 import manufacturing_quality as manufacturing_quality_mod
from app.api.v1 import manufacturing_trace as manufacturing_trace_mod
from app.api.v1 import manufacturing_planning as manufacturing_planning_mod
from app.api.v1 import manufacturing_equipment as manufacturing_equipment_mod
from app.api.v1 import manufacturing_labor as manufacturing_labor_mod
from app.api.v1 import manufacturing_ai as manufacturing_ai_mod
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
from app.api.v1 import drive_phase2 as drive_phase2_mod
from app.api.v1 import drive_webdav as drive_webdav_mod
from app.api.v1 import finance_currencies
from app.api.v1 import crm_tickets
from app.api.v1 import mail_filters
from app.api.v1 import admin_mail
from app.api.v1 import admin_drive
from app.api.v1 import admin_docs
from app.api.v1 import admin_meetings
from app.api.v1 import admin_db_health
from app.api.v1 import admin_parity
from app.api.v1 import ai_features as ai_features_mod
from app.api.v1 import crm_links
from app.api.v1 import projects_integrations as projects_integrations_mod
from app.api.v1 import cross_module_links as cross_module_links_mod
from app.api.v1 import admin_mail_dns
from app.api.v1 import agent as agent_mod
from app.api.v1 import handbook
from app.api.v1 import projects_subtasks as projects_subtasks_mod
from app.api.v1 import projects_custom_fields as projects_custom_fields_mod
from app.api.v1 import projects_comments as projects_comments_mod
from app.api.v1 import projects_recurring as projects_recurring_mod
from app.api.v1 import projects_sprints as projects_sprints_mod
from app.api.v1 import projects_automation as projects_automation_mod
from app.api.v1 import projects_guests as projects_guests_mod
from app.api.v1 import projects_email_inbound as projects_email_inbound_mod
from app.api.v1 import hr_skills as hr_skills_mod
from app.api.v1 import hr_compensation as hr_compensation_mod
from app.api.v1 import hr_scheduling as hr_scheduling_mod
from app.api.v1 import hr_goals as hr_goals_mod
from app.api.v1 import hr_audit as hr_audit_mod
from app.api.v1 import hr_manager_dashboard as hr_manager_dashboard_mod
from app.api.v1 import hr_engagement as hr_engagement_mod
from app.api.v1 import hr_ai_intelligence as hr_ai_intelligence_mod
from app.api.v1 import hr_people_analytics as hr_people_analytics_mod
from app.api.v1 import crm_contacts_v2 as crm_contacts_v2_mod
from app.api.v1 import crm_custom_fields as crm_custom_fields_mod
from app.api.v1 import crm_scoring as crm_scoring_mod
from app.api.v1 import crm_pipelines as crm_pipelines_mod
from app.api.v1 import crm_activities as crm_activities_mod
from app.api.v1 import crm_sequences as crm_sequences_mod
from app.api.v1 import crm_templates as crm_templates_mod
# CRM Phase 2 — Marketing, Service Hub, Workflows, Reports
from app.api.v1 import crm_marketing as crm_marketing_mod
from app.api.v1 import crm_service as crm_service_mod
from app.api.v1 import crm_workflows as crm_workflows_mod
from app.api.v1 import crm_reports_v2 as crm_reports_v2_mod
# CRM Phase 3 — AI Agents, Custom Objects, Collaboration, Audit
from app.api.v1 import crm_ai_agents as crm_ai_agents_mod
from app.api.v1 import crm_custom_objects as crm_custom_objects_mod
from app.api.v1 import crm_collaboration as crm_collaboration_mod
from app.api.v1 import crm_audit as crm_audit_mod
# Finance Phase 2A — AI-era upgrades
from app.api.v1 import finance_estimates as finance_estimates_mod
from app.api.v1 import finance_workflows as finance_workflows_mod
from app.api.v1 import finance_ai as finance_ai_mod
from app.api.v1 import finance_batch as finance_batch_mod
# POS Upgrade — Loyalty, KDS, Gift Cards/Store Credit
from app.api.v1 import loyalty as loyalty_mod
from app.api.v1 import kds as kds_mod
from app.api.v1 import pos_loyalty as pos_loyalty_mod
# HR ATS — Applicant Tracking System
from app.api.v1 import hr_ats as hr_ats_mod
# HR LMS — Learning Management System
from app.api.v1 import hr_lms as hr_lms_mod
# HR Onboarding/Offboarding Extended
from app.api.v1 import hr_onboarding_ext as hr_onboarding_ext_mod
# HR Bulk Import — Rippling, BambooHR, HiBob, ADP, CSV/JSON
from app.api.v1 import hr_import as hr_import_mod
# HR Phase 3 — AI Intelligence, Workflows, People Analytics
from app.api.v1 import hr_ai_intelligence as hr_ai_intelligence_mod
from app.api.v1 import hr_workflows as hr_workflows_mod
from app.api.v1 import hr_people_analytics as hr_people_analytics_mod
# Inventory Phase 1-6 upgrades
from app.api.v1 import inventory_serial_uom as inv_serial_uom_mod
from app.api.v1 import inventory_wms as inv_wms_mod
from app.api.v1 import inventory_replenishment as inv_replenishment_mod
from app.api.v1 import inventory_kits as inv_kits_mod
from app.api.v1 import inventory_costing as inv_costing_mod
from app.api.v1 import inventory_automation as inv_automation_mod
from app.api.v1 import ecommerce_b2b as ecommerce_b2b_mod
from app.api.v1 import ecommerce_loyalty as ecommerce_loyalty_mod
from app.api.v1 import ecommerce_subscriptions as ecommerce_subscriptions_mod
from app.api.v1 import ecommerce_import as ecommerce_import_mod
from app.api.v1 import ecommerce_blog as ecommerce_blog_mod
# Support Phase 1 — Live Chat, Audit, Time Tracking, Views, Templates, Presence, Inbound Email
from app.api.v1 import support_livechat as support_livechat_mod
from app.api.v1 import support_audit as support_audit_mod
# Support Phase 2 — Automation Engine
from app.api.v1 import support_automation as support_automation_mod
from app.api.v1 import support_time as support_time_mod
from app.api.v1 import support_views as support_views_mod
from app.api.v1 import support_templates as support_templates_mod
from app.api.v1 import support_presence as support_presence_mod
from app.api.v1 import support_inbound as support_inbound_mod
# Y&U Teams — Chat & Channels
from app.api.v1 import chat as chat_mod
from app.api.v1 import chat_ws as chat_ws_mod
# Calendar Attachments — upload, list, delete, presigned download
from app.api.v1 import calendar_attachments as calendar_attachments_mod
# Calendar Mega-Upgrade — Booking Pages, Analytics, Focus Time, Resources, Automation
from app.api.v1 import booking as booking_mod
from app.api.v1 import calendar_analytics as calendar_analytics_mod
from app.api.v1 import calendar_focus as calendar_focus_mod
from app.api.v1 import calendar_resources as calendar_resources_mod
from app.api.v1 import calendar_automation as calendar_automation_mod
from app.api.v1 import calendar_ai_router as calendar_ai_mod
from app.api.v1 import calendar_mail_scanner as calendar_mail_scanner_mod
from app.api.v1 import calendar_task_sync as calendar_task_sync_mod
from app.api.v1 import calendar_group as calendar_group_mod
from app.api.v1 import calendar_scheduling as calendar_scheduling_mod
# Era Mail Advanced — AI Triage, Focused Inbox, Smart Folders, FTS, Cross-Module
from app.api.v1 import mail_advanced as mail_advanced_mod
# Mail Accounts — multi-account management
from app.api.v1 import mail_accounts as mail_accounts_mod
# Y&U Notes Mega-Upgrade — Notebooks, Hierarchy, Versions, Comments, Entity Links
from app.api.v1 import notebooks as notebooks_mod
from app.api.v1 import notes_ai as notes_ai_mod
from app.api.v1 import notes_widgets as notes_widgets_mod
from app.api.v1 import notes_convert as notes_convert_mod
from app.api.v1 import notes_templates_seeder as notes_templates_seeder_mod
from app.api.v1 import note_databases as note_databases_mod
from app.api.v1 import collab as collab_mod
from app.api.v1 import calendar_roi as calendar_roi_mod
# Notes Mega-Upgrade — Analytics, Sync, Share Links, Email Inbound
from app.api.v1 import notes_analytics as notes_analytics_mod
from app.api.v1 import notes_sync as notes_sync_mod
from app.api.v1 import notes_share as notes_share_mod
from app.api.v1 import notes_email_inbound as notes_email_inbound_mod

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
api_router.include_router(finance.router, prefix="/finance", tags=["Finance"], dependencies=[Depends(require_app_access("finance"))])
api_router.include_router(hr.router, prefix="/hr", tags=["HR"], dependencies=[Depends(require_app_access("hr"))])
api_router.include_router(crm.router, prefix="/crm", tags=["CRM"], dependencies=[Depends(require_app_access("crm"))])
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
api_router.include_router(supplychain_planning_mod.router, prefix="/supply-chain", tags=["Supply Chain Planning"])
api_router.include_router(supplychain_ops_mod.router, prefix="/supply-chain", tags=["Supply Chain Operations"])
api_router.include_router(supplychain_ext_mod.router, prefix="/supply-chain", tags=["Supply Chain Extensions"])
api_router.include_router(supplychain_risk_mod.router, tags=["Supply Chain Risk & MRP"])
api_router.include_router(supplychain_logistics_mod.router, prefix="/supply-chain", tags=["Supply Chain Logistics"])
api_router.include_router(manufacturing_ext_mod.router, prefix="/manufacturing", tags=["Manufacturing Extensions"])
api_router.include_router(manufacturing_eco_mod.router, prefix="/manufacturing", tags=["Manufacturing ECO"])
api_router.include_router(manufacturing_quality_mod.router, prefix="/manufacturing", tags=["Manufacturing Quality"])
api_router.include_router(manufacturing_trace_mod.router, prefix="/manufacturing", tags=["Manufacturing Traceability"])
api_router.include_router(manufacturing_planning_mod.router, prefix="/manufacturing", tags=["Manufacturing Planning"])
api_router.include_router(manufacturing_equipment_mod.router, prefix="/manufacturing", tags=["Manufacturing Equipment"])
api_router.include_router(manufacturing_labor_mod.router, prefix="/manufacturing", tags=["Manufacturing Labor"])
api_router.include_router(manufacturing_ai_mod.router, prefix="/manufacturing", tags=["Manufacturing AI"])
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
api_router.include_router(drive_phase2_mod.router, prefix="/drive", tags=["Drive Phase 2+3"])
api_router.include_router(drive_webdav_mod.router, prefix="/drive", tags=["Drive WebDAV"])
api_router.include_router(finance_currencies.router, prefix="/finance", tags=["Finance Currencies"])
api_router.include_router(crm_tickets.router, prefix="/crm", tags=["CRM Tickets"])
api_router.include_router(mail_filters.router, prefix="/mail", tags=["Mail Filters"])
api_router.include_router(admin_mail.router, prefix="/admin/mail", tags=["Admin Mail Config"])
api_router.include_router(admin_drive.router, prefix="/admin/drive", tags=["Admin Drive Config"])
api_router.include_router(admin_db_health.router, prefix="/admin/db-health", tags=["Admin DB Health"])
api_router.include_router(admin_parity.router, prefix="/admin/parity", tags=["Admin Parity"])
api_router.include_router(admin_docs.router, prefix="/admin/docs", tags=["Admin Docs Config"])
api_router.include_router(admin_meetings.router, prefix="/admin/meetings", tags=["Admin Meetings Config"])
api_router.include_router(ai_features_mod.router, tags=["AI Features"])
api_router.include_router(crm_links.router, prefix="/crm", tags=["CRM Cross-Module Links"])
api_router.include_router(projects_integrations_mod.router, prefix="/projects", tags=["Projects Integrations"])
api_router.include_router(cross_module_links_mod.router, tags=["Cross-Module Links"])
api_router.include_router(admin_mail_dns.router, prefix="/admin/mail", tags=["Admin Mail DNS"])
api_router.include_router(agent_mod.router, prefix="/agent", tags=["Agent (Urban Bad AI)"])
api_router.include_router(handbook.router, prefix="/handbook", tags=["Handbook"])
api_router.include_router(projects_subtasks_mod.router, prefix="/projects", tags=["Projects Subtasks & Checklists"])
api_router.include_router(projects_custom_fields_mod.router, prefix="/projects", tags=["Projects Custom Fields"])
api_router.include_router(projects_comments_mod.router, prefix="/projects", tags=["Projects Comments"])
api_router.include_router(projects_recurring_mod.router, prefix="/projects", tags=["Projects Recurring Tasks"])
api_router.include_router(projects_sprints_mod.router, prefix="/projects", tags=["Projects Sprints & Backlog"])
api_router.include_router(projects_automation_mod.router, prefix="/projects", tags=["Projects Automation"])
api_router.include_router(projects_guests_mod.router, prefix="/projects", tags=["Projects Guest Access"])
api_router.include_router(projects_email_inbound_mod.router, prefix="/projects", tags=["Projects Email Inbound"])
api_router.include_router(hr_skills_mod.router, prefix="/hr", tags=["HR Skills & 360°"])
api_router.include_router(hr_compensation_mod.router, prefix="/hr", tags=["HR Compensation"])
api_router.include_router(hr_scheduling_mod.router, prefix="/hr", tags=["HR Scheduling"])
api_router.include_router(hr_goals_mod.router, prefix="/hr", tags=["HR Goals & OKR"])
api_router.include_router(hr_audit_mod.router, prefix="/hr", tags=["HR Audit"])
api_router.include_router(hr_manager_dashboard_mod.router, prefix="/hr", tags=["HR Manager Dashboard"])
api_router.include_router(hr_engagement_mod.router, prefix="/hr", tags=["HR Engagement"])
api_router.include_router(hr_ai_intelligence_mod.router, prefix="/hr", tags=["HR AI Intelligence"])
api_router.include_router(hr_people_analytics_mod.router, prefix="/hr", tags=["HR People Analytics"])
api_router.include_router(crm_contacts_v2_mod.router, prefix="/crm", tags=["CRM Contacts V2"])
api_router.include_router(crm_custom_fields_mod.router, prefix="/crm", tags=["CRM Custom Fields"])
api_router.include_router(crm_scoring_mod.router, prefix="/crm", tags=["CRM Lead Scoring"])
api_router.include_router(crm_pipelines_mod.router, prefix="/crm", tags=["CRM Pipelines"])
api_router.include_router(crm_activities_mod.router, prefix="/crm", tags=["CRM Activities"])
api_router.include_router(crm_sequences_mod.router, prefix="/crm", tags=["CRM Sequences"])
api_router.include_router(crm_templates_mod.router, prefix="/crm", tags=["CRM Templates"])
# CRM Phase 2 — Marketing, Service Hub, Workflows, Reports
api_router.include_router(crm_marketing_mod.router, prefix="/crm", tags=["CRM Marketing"])
api_router.include_router(crm_service_mod.router, prefix="/crm", tags=["CRM Service Hub"])
api_router.include_router(crm_workflows_mod.router, prefix="/crm", tags=["CRM Workflows"])
api_router.include_router(crm_reports_v2_mod.router, prefix="/crm", tags=["CRM Reports & Dashboards"])
# CRM Phase 3 — AI Agents, Custom Objects, Collaboration, Audit
api_router.include_router(crm_ai_agents_mod.router, prefix="/crm", tags=["CRM AI Agents"])
api_router.include_router(crm_custom_objects_mod.router, prefix="/crm", tags=["CRM Custom Objects"])
api_router.include_router(crm_collaboration_mod.router, prefix="/crm", tags=["CRM Collaboration"])
api_router.include_router(crm_audit_mod.router, prefix="/crm", tags=["CRM Audit"])
# Finance Phase 2A — AI-era upgrades
api_router.include_router(finance_estimates_mod.router, prefix="/finance", tags=["Finance Estimates"])
api_router.include_router(finance_workflows_mod.router, prefix="/finance", tags=["Finance Workflows"])
api_router.include_router(finance_ai_mod.router, prefix="/finance", tags=["Finance AI"])
api_router.include_router(finance_batch_mod.router, prefix="/finance", tags=["Finance Batch & Revenue Recognition"])
# POS Upgrade — Loyalty, KDS, Gift Cards/Store Credit
api_router.include_router(loyalty_mod.router, prefix="/loyalty", tags=["Loyalty"])
api_router.include_router(kds_mod.router, prefix="/kds", tags=["KDS"])
api_router.include_router(pos_loyalty_mod.router, prefix="/pos", tags=["POS Gift Cards & Store Credit"])
api_router.include_router(hr_ats_mod.router, prefix="/hr", tags=["HR ATS"])
api_router.include_router(hr_lms_mod.router, prefix="/hr", tags=["HR LMS"])
api_router.include_router(hr_onboarding_ext_mod.router, prefix="/hr", tags=["HR Onboarding & Offboarding"])
api_router.include_router(hr_import_mod.router, prefix="/hr", tags=["HR Bulk Import"])
# HR Phase 3 — AI Intelligence, Workflows, People Analytics
api_router.include_router(hr_ai_intelligence_mod.router, prefix="/hr", tags=["HR AI Intelligence"])
api_router.include_router(hr_workflows_mod.router, prefix="/hr", tags=["HR Workflows"])
api_router.include_router(hr_people_analytics_mod.router, prefix="/hr", tags=["HR People Analytics"])
# Inventory Phase 1-6 upgrades
api_router.include_router(inv_serial_uom_mod.router, prefix="/inventory", tags=["Inventory Serial & UoM"])
api_router.include_router(inv_wms_mod.router, prefix="/inventory", tags=["Inventory WMS"])
api_router.include_router(inv_replenishment_mod.router, prefix="/inventory", tags=["Inventory Replenishment"])
api_router.include_router(inv_kits_mod.router, prefix="/inventory", tags=["Inventory Kits & Pricing"])
api_router.include_router(inv_costing_mod.router, prefix="/inventory", tags=["Inventory Costing"])
api_router.include_router(inv_automation_mod.router, prefix="/inventory", tags=["Inventory Automation"])
# E-Commerce Upgrade — B2B, Loyalty, Subscriptions, Import, Blog
api_router.include_router(ecommerce_b2b_mod.router, prefix="/ecommerce", tags=["E-Commerce B2B"])
api_router.include_router(ecommerce_loyalty_mod.router, prefix="/ecommerce", tags=["E-Commerce Loyalty"])
api_router.include_router(ecommerce_subscriptions_mod.router, prefix="/ecommerce", tags=["E-Commerce Subscriptions"])
api_router.include_router(ecommerce_import_mod.router, prefix="/ecommerce", tags=["E-Commerce Import"])
api_router.include_router(ecommerce_blog_mod.router, prefix="/ecommerce", tags=["E-Commerce Blog"])
api_router.include_router(ecommerce_blog_mod.storefront_blog_router, prefix="/storefront", tags=["Storefront Blog"])
# Support Phase 1
api_router.include_router(support_livechat_mod.router, prefix="/support", tags=["Support Live Chat"])
api_router.include_router(support_audit_mod.router, prefix="/support", tags=["Support Audit Log"])
api_router.include_router(support_time_mod.router, prefix="/support", tags=["Support Time Tracking"])
api_router.include_router(support_views_mod.router, prefix="/support", tags=["Support Saved Views"])
api_router.include_router(support_templates_mod.router, prefix="/support", tags=["Support Templates"])
api_router.include_router(support_presence_mod.router, prefix="/support", tags=["Support Presence"])
api_router.include_router(support_inbound_mod.router, prefix="/support", tags=["Support Inbound Email"])
# Support Phase 2
api_router.include_router(support_automation_mod.router, prefix="/support", tags=["Support Automation Engine"])
from app.api.v1 import support_portal as support_portal_mod
api_router.include_router(support_portal_mod.router, prefix="/support", tags=["Support Portal"])
from app.api.v1 import support_forum as support_forum_mod
api_router.include_router(support_forum_mod.router, prefix="/support", tags=["Support Forum"])
from app.api.v1 import support_omnichannel as support_omnichannel_mod
api_router.include_router(support_omnichannel_mod.router, prefix="/support", tags=["Support Omnichannel"])
# Support Phase 3 — Sandboxes
from app.api.v1 import support_sandbox as support_sandbox_mod
api_router.include_router(support_sandbox_mod.router, prefix="/support", tags=["Support Sandboxes"])
# Support Phase 3 — Advanced Analytics
from app.api.v1 import support_analytics_adv as support_analytics_adv_mod
api_router.include_router(support_analytics_adv_mod.router, prefix="/support", tags=["Support Advanced Analytics"])
# Support Phase 3 — Agent Skills & Workforce Management
from app.api.v1 import support_skills as support_skills_mod
api_router.include_router(support_skills_mod.router, prefix="/support", tags=["Support Agent Skills & Workforce"])
# Support Phase 3 — Proactive Support & Voice
from app.api.v1 import support_proactive as support_proactive_mod
api_router.include_router(support_proactive_mod.router, prefix="/support", tags=["Support Proactive Rules"])
from app.api.v1 import support_voice as support_voice_mod
api_router.include_router(support_voice_mod.router, prefix="/support", tags=["Support Voice Calls"])
# Y&U Teams — Chat & Channels
api_router.include_router(chat_mod.router, prefix="/chat", tags=["Y&U Teams Chat"])
api_router.include_router(chat_ws_mod.router, prefix="/chat", tags=["Y&U Teams Chat WebSocket"])
from app.api.v1 import chat_extended as chat_ext_mod
api_router.include_router(chat_ext_mod.router, prefix="/chat", tags=["Y&U Teams Extended"])
# Calendar Attachments
api_router.include_router(calendar_attachments_mod.router, tags=["Calendar - Attachments"])
# Calendar Mega-Upgrade — Booking Pages, Analytics, Focus Time, Resources, Automation
api_router.include_router(booking_mod.router, prefix="/booking", tags=["Booking Pages"])
api_router.include_router(calendar_analytics_mod.router, prefix="/calendar", tags=["Calendar Analytics & Prep"])
api_router.include_router(calendar_focus_mod.router, prefix="/calendar", tags=["Calendar - Focus Time"])
api_router.include_router(calendar_resources_mod.router)
api_router.include_router(calendar_mail_scanner_mod.router)
api_router.include_router(calendar_automation_mod.router)
api_router.include_router(calendar_ai_mod.router)
# Calendar – Task Sync (auto time-blocking + two-way sync)
api_router.include_router(calendar_task_sync_mod.router)
# Calendar – Group/Department Calendars
api_router.include_router(calendar_group_mod.router)
# Calendar – Scheduling Intelligence (priority negotiation, travel buffers, prediction)
api_router.include_router(calendar_scheduling_mod.router)
# Era Mail Advanced
api_router.include_router(mail_advanced_mod.router, prefix="/mail", tags=["Mail Advanced"])
# Mail Accounts — multi-account management
api_router.include_router(mail_accounts_mod.router, prefix="/mail", tags=["Mail Accounts"])
# Y&U Notes Mega-Upgrade — Notebooks, Hierarchy, Versions, Comments, Entity Links
api_router.include_router(notebooks_mod.router, prefix="/notebooks", tags=["Notebooks"])
api_router.include_router(notes_ai_mod.router, prefix="/notes/ai", tags=["Notes AI"])
api_router.include_router(notes_widgets_mod.router, prefix="/notes/widgets", tags=["Notes Widgets"])
api_router.include_router(notes_convert_mod.router, prefix="/notes/convert", tags=["Notes Convert"])
api_router.include_router(notes_templates_seeder_mod.router, prefix="/notes/templates", tags=["Notes Templates Seeder"])
api_router.include_router(note_databases_mod.router, prefix="/note-databases", tags=["Note Databases"])
api_router.include_router(collab_mod.router, prefix="/collab", tags=["Notes Collaboration"])
# Notes Mega-Upgrade — Analytics, Sync, Share Links, Email Inbound
api_router.include_router(notes_analytics_mod.router, prefix="/notes", tags=["Notes Analytics"])
api_router.include_router(notes_sync_mod.router, prefix="/notes", tags=["Notes Sync"])
api_router.include_router(notes_share_mod.router, prefix="/notes", tags=["Notes Share Links"])
api_router.include_router(notes_email_inbound_mod.router, prefix="/notes", tags=["Notes Email Inbound"])
# Y&U Analytics Upgrade — Schema Introspection, Copilot, Semantic Models
api_router.include_router(analytics_schema_mod.router, prefix="/analytics", tags=["Analytics Schema & Copilot"])
# Calendar ROI & AI Meeting Coach
api_router.include_router(calendar_roi_mod.router, tags=["Calendar - ROI & Coaching"])
# Calendar — Webhooks & API Keys
from app.api.v1 import calendar_webhooks as calendar_webhooks_mod
api_router.include_router(calendar_webhooks_mod.router)
# Drive Phase 3 — Admin, AI Features
from app.api.v1 import drive_admin as drive_admin_mod
from app.api.v1 import drive_ai_features as drive_ai_features_mod
api_router.include_router(drive_admin_mod.router, prefix="/drive", tags=["Drive Admin"])
api_router.include_router(drive_ai_features_mod.router, prefix="/drive", tags=["Drive AI Features"])
# Security — MFA endpoints
from app.api.v1 import mfa as mfa_mod
api_router.include_router(mfa_mod.router, prefix="/auth", tags=["MFA"])
# Security Phase 2+3 — Sessions, API Keys, Security Dashboard, Compliance
from app.api.v1 import sessions as sessions_mod
from app.api.v1 import api_keys as api_keys_mod
from app.api.v1 import security_dashboard as security_dashboard_mod
from app.api.v1 import compliance as compliance_mod
api_router.include_router(sessions_mod.router, prefix="/auth/sessions", tags=["Sessions"])
api_router.include_router(api_keys_mod.router, prefix="/auth/api-keys", tags=["API Keys"])
api_router.include_router(security_dashboard_mod.router, prefix="/admin/security", tags=["Security Dashboard"])
api_router.include_router(compliance_mod.router, prefix="/users", tags=["Compliance & GDPR"])
# Performance — SSE data push + metrics
from app.api.v1 import data_push as data_push_mod
from app.api.v1 import perf as perf_mod
api_router.include_router(data_push_mod.router, prefix="/data-push", tags=["Real-time Data Push"])
api_router.include_router(perf_mod.router, prefix="/perf", tags=["Performance Monitoring"])
