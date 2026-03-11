# Y&U CRM – Rewrite Checklist

**Status: 100% COMPLETE** (57/57 items — Phase 2 + Phase 4 + Extensions + Cross-Module + Responsive)
**Owner: 100% Ours**

## Database Models
- [x] Contact model (first_name, last_name, email, phone, company, type: lead/customer/vendor, owner_id)
- [x] Lead model (contact_id, source, status, score, assigned_to)
- [x] Deal model (name, contact_id, stage, value, probability, expected_close, pipeline_id)
- [x] Pipeline model (name, stages JSON)
- [x] Activity model (contact_id, deal_id, type: call/email/meeting/note, description, date)
- [x] Campaign model (name, type, status, budget, start_date, end_date)
- [x] CampaignContact model (campaign_id, contact_id, status: sent/opened/clicked/converted)
- [x] Ticket model (contact_id, subject, description, status, priority, assigned_to) — `CRMTicket` in `models/crm.py`
- [x] Product model (name, description, price, sku, category) — for deal line items
- [x] Quote model (deal_id, items JSON, total, status, valid_until)

## API Endpoints (FastAPI)
- [x] GET/POST /crm/contacts
- [x] GET/PUT/DELETE /crm/contacts/{id}
- [x] GET/POST /crm/leads
- [x] PUT /crm/leads/{id}/convert (lead → customer)
- [x] GET/POST /crm/deals
- [x] GET/PUT/DELETE /crm/deals/{id}
- [x] GET/POST /crm/pipelines
- [x] GET /crm/activities
- [x] GET/POST /crm/campaigns
- [x] GET /crm/campaigns/{id}/analytics
- [x] GET/POST /crm/tickets — `crm_tickets.py` registered at `/crm` prefix
- [x] PUT /crm/tickets/{id}/assign — `crm_tickets.py` assign endpoint
- [x] POST /crm/deals/{id}/quote
- [x] GET /crm/reports/pipeline (conversion rates)
- [x] GET /crm/reports/sales-forecast
- [x] GET /crm/contacts/{id}/timeline (all activities)
- [x] POST /crm/contacts/import (CSV)
- [x] GET /crm/contacts/export

## Frontend Pages (React)
- [x] CRM dashboard
- [x] Contact list + detail
- [x] Lead management
- [x] Deal pipeline (Kanban)
- [x] Deal detail
- [x] Campaign management
- [x] Campaign analytics (email opens, conversions)
- [x] Support tickets — `features/crm/TicketsPage.tsx`
- [x] Contact timeline (all interactions)
- [x] Quote builder
- [x] Sales forecast chart
- [x] Pipeline analytics (win rate, average deal size)
- [x] Contact import wizard

## Integrations
- [x] CRM → Finance: deal won → auto-invoice
- [x] CRM → Mail: email linked to contacts — `integration_handlers.py` `opportunity.stage_changed` sends email to deal owner via Stalwart
- [x] CRM → Calendar: schedule follow-ups — `crm_links.py` POST /crm/contacts/{id}/schedule-followup + /crm/deals/{id}/schedule-followup creates CalendarEvent
- [x] CRM → Meetings: meeting linked to deals — `crm_links.py` POST /crm/contacts/{id}/schedule-meeting + /crm/deals/{id}/schedule-meeting
- [x] CRM → Forms: lead capture forms — `crm_links.py` POST /crm/lead-capture-forms + form.submitted event → auto-create lead
- [x] CRM → E-Commerce: customer sync — `crm_links.py` POST /crm/contacts/{id}/sync-ecommerce + /crm/contacts/import-from-ecommerce
- [x] AI lead scoring — `ai_features.py` `/crm/leads/{id}/ai-score` + `ai_tools.py` `score_lead` tool
- [x] AI next-best-action suggestions — `ai_features.py` `/crm/deals/{id}/ai-next-action`, `/crm/contacts/{id}/ai-next-action`, `/crm/opportunities/{id}/ai-next-action`

## Tests
- [x] Contact CRUD tests
- [x] Deal pipeline tests
- [x] Lead conversion tests — `test_crm_extended.py`: lead→opportunity conversion, double conversion rejection, full pipeline test
- [x] Campaign tests — `test_crm_extended.py`: CRUD, analytics, filtering, not-found
- [x] Pipeline analytics tests — `test_crm_extended.py`: pipeline view, win rate report, sales forecast

## Mobile / Responsive
- [x] Responsive pipeline view — PipelinePage.tsx has overflow-x-auto horizontal scroll, flex-shrink-0 columns, sm:/lg: breakpoints, mobile scroll hint
- [x] Mobile contact detail — ContactDetail.tsx has collapsible sections on mobile, min-h-[44px] touch targets, sm:/md: breakpoints, mobile card lists
- [x] Quick activity logging — `QuickActivityLog.tsx` FAB visible on mobile (md:hidden fixed bottom-6 right-6)
