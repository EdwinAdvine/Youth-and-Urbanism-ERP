# Support & Help Desk Module

> Omnichannel ticket management, SLA tracking, AI triage, and customer portal.

## Overview

The Support module provides a full-featured help desk system with multi-channel ticket intake (email, live chat, voice, portal), SLA enforcement, AI-powered triage, knowledge base, and agent skill-based routing.

**Who uses it:** Support Agents, Support Admins, Customers (via portal)
**Requires:** Support App Admin for configuration; agents access their queue

---

## Features

- **Ticket Management** — create, assign, reply to, and close support tickets
- **SLA Tracking** — response and resolution time limits with escalation rules
- **Omnichannel** — email, live chat, voice, customer portal, proactive support
- **AI Triage** — auto-categorize, prioritize, and suggest responses using AI
- **Agent Skills Routing** — route tickets to agents with matching skills
- **Knowledge Base** — internal and public-facing article library
- **Customer Portal** — self-service portal for customers to submit and track tickets
- **Satisfaction Surveys** — CSAT surveys sent after ticket resolution
- **Escalation Rules** — auto-escalate overdue or high-priority tickets
- **Time Tracking** — log time spent per ticket for billing and reporting
- **Analytics** — ticket volume, response times, agent performance, CSAT scores
- **Live Chat** — real-time chat widget for website visitors
- **Presence** — agent online/away/busy status with queue management
- **Forum** — community forum for peer-to-peer support
- **Sandbox** — test environment for support workflow development

---

## Architecture

### Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/support.py` | Core ticket CRUD and reply management |
| `backend/app/api/v1/support_analytics_adv.py` | Advanced support analytics |
| `backend/app/api/v1/support_audit.py` | Ticket change audit trail |
| `backend/app/api/v1/support_automation.py` | Auto-assignment and escalation rules |
| `backend/app/api/v1/support_forum.py` | Community forum management |
| `backend/app/api/v1/support_inbound.py` | Email → ticket conversion |
| `backend/app/api/v1/support_livechat.py` | Real-time live chat management |
| `backend/app/api/v1/support_omnichannel.py` | Unified inbox across channels |
| `backend/app/api/v1/support_portal.py` | Customer self-service portal |
| `backend/app/api/v1/support_presence.py` | Agent presence and availability |
| `backend/app/api/v1/support_proactive.py` | Proactive outreach campaigns |
| `backend/app/api/v1/support_skills.py` | Agent skill management |
| `backend/app/api/v1/support_templates.py` | Reply templates and macros |
| `backend/app/api/v1/support_time.py` | Time tracking per ticket |
| `backend/app/api/v1/support_voice.py` | Voice call integration |
| `frontend/src/features/support/` | Support frontend pages |
| `frontend/src/api/support.ts` | Support API client hooks |

---

## Data Models

| Model | Table | Description |
|-------|-------|-------------|
| `SupportTicket` | `support_tickets` | A customer support request |
| `TicketReply` | `support_ticket_replies` | Reply in a ticket thread |
| `TicketLabel` | `support_ticket_labels` | Category/tag on a ticket |
| `SLAPolicy` | `support_sla_policies` | Response/resolution time SLA |
| `AgentSkill` | `support_agent_skills` | Skills an agent has for routing |
| `SatisfactionSurvey` | `support_surveys` | Post-resolution CSAT survey |

---

## Ticket Lifecycle

```
new → open → in_progress → resolved → closed
              ↓
          on_hold (waiting for customer)
              ↓
          escalated (SLA breach or manual escalation)
```

## SLA Configuration

| Priority | First Response | Resolution |
|----------|---------------|------------|
| Critical | 1 hour | 4 hours |
| High | 4 hours | 24 hours |
| Medium | 8 hours | 72 hours |
| Low | 24 hours | 7 days |

---

## Cross-Module Integrations

| Module | Integration |
|--------|-------------|
| Mail | Inbound emails auto-create tickets; replies sent via SMTP |
| CRM | Tickets linked to CRM Contacts for customer context |
| Projects | Support issues escalated to project tasks |
| AI | AI categorizes tickets and suggests agent responses |
| Knowledge Base | Related articles suggested on ticket creation |
