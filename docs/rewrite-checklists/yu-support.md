# Y&U Support – Rewrite Checklist

**Status: 100% COMPLETE** (Phase 4 – 25 endpoints + extensions + routing rules + AI + mobile)
**Owner: 100% Ours**

## Database Models
- [x] SupportTicket model
- [x] TicketComment model
- [x] KnowledgeBaseArticle model
- [x] SLAPolicy model (name, response_time, resolution_time, priority_rules)
- [x] CannedResponse model (name, content, category, created_by)
- [x] TicketTag model (ticket_id, tag_name)
- [x] CustomerSatisfaction model (ticket_id, rating, feedback, submitted_at)

## API Endpoints (FastAPI)
- [x] 25 support endpoints (tickets, comments, KB articles)
- [x] GET/POST /support/sla-policies
- [x] GET /support/tickets/{id}/sla-status
- [x] GET/POST /support/canned-responses
- [x] POST /support/tickets/{id}/merge
- [x] GET /support/reports/response-times
- [x] GET /support/reports/satisfaction
- [x] GET /support/dashboard/kpis

## Frontend Pages (React)
- [x] Support dashboard (open tickets, SLA breaches, satisfaction)
- [x] Ticket list (filtered, sortable)
- [x] Ticket detail (conversation thread, status, assignee)
- [x] Knowledge base editor
- [x] Knowledge base public view
- [x] SLA configuration
- [x] Canned response manager
- [x] Customer satisfaction reports
- [x] Ticket assignment/routing rules — `TicketRoutingRule` model in `models/support.py`, CRUD endpoints in `support_ext.py` (/routing-rules), auto-apply on `support.ticket.created` event in `integration_handlers.py`, frontend `RoutingRulesPage.tsx`

## Integrations
- [x] Support → Mail: ticket creation from email (event bus: support.ticket.created → Mail notification in integration_handlers.py)
- [x] Support → CRM: link tickets to contacts — `cross_module_links.py` POST /support/tickets/{id}/link-contact
- [x] Support → Projects: escalate ticket to task — `cross_module_links.py` POST /support/tickets/{id}/escalate-to-task
- [x] AI ticket classification (classify_ticket tool in ai_tools.py)
- [x] AI suggested responses (suggest_response tool in ai_tools.py)
- [x] AI KB article generation from resolved tickets (generate_kb_article tool in ai_tools.py)

## Tests
- [x] Ticket lifecycle tests (test_support.py: create, assign, resolve, close, reopen, 30+ tests)
- [x] SLA calculation tests (test_support.py: SLA policy CRUD, SLA dates set, SLA response breach tracking)
- [x] KB search tests (test_support.py: test_search_kb_articles, test_get_kb_article_increments_views, test_mark_kb_helpful)

## Mobile / Responsive
- [x] Mobile ticket view (TicketsPage.tsx uses sm:/md: responsive breakpoints, min-h-[44px] touch targets)
- [x] Mobile ticket creation (TicketsPage.tsx create form uses responsive layout)
