# CRM Module

> Customer Relationship Management — contacts, leads, deals, pipelines, campaigns, and AI-powered sales tools.

## Overview

The CRM module provides a complete sales and customer management system. It tracks the full customer lifecycle from initial lead through deal closure, with AI-powered scoring, workflow automation, and deep integration with mail, calendar, and finance.

**Who uses it:** Sales teams, Account Managers, Marketing, CRM Admins
**Requires:** CRM App Admin access, or specific crm.* permissions

---

## Features

- **Contacts** — unified contact database (people and organizations)
- **Leads** — inbound lead tracking with source attribution
- **Opportunities & Deals** — Kanban pipeline with drag-and-drop stage management
- **AI Lead Scoring** — ML-powered lead quality scoring (0–100)
- **Custom Fields** — add any field to contacts, leads, or deals without code changes
- **Custom Objects** — create entirely new entity types linked to CRM records
- **Marketing Campaigns** — email campaigns with open/click tracking
- **Email Sequences** — automated multi-step email sequences
- **Workflow Automation** — trigger actions on CRM events (stage change, score threshold, etc.)
- **AI Agents** — task-specific AI agents (research contact, draft proposal, etc.)
- **Collaboration** — shared notes, activity feed, @mentions on CRM records
- **CRM Audit Trail** — full history of all changes to every record
- **Reports & Dashboards** — pipeline velocity, win rate, revenue forecast, rep performance
- **Form Integration** — form submissions auto-create CRM leads
- **Tickets** — lightweight support ticket tracking linked to contacts

---

## Architecture

### Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/crm.py` | Core CRUD: contacts, leads, opportunities, deals, pipeline |
| `backend/app/api/v1/crm_activities.py` | Activity logging (calls, meetings, emails, notes) |
| `backend/app/api/v1/crm_ai_agents.py` | AI agents for CRM tasks |
| `backend/app/api/v1/crm_audit.py` | Audit trail and change history |
| `backend/app/api/v1/crm_collaboration.py` | Shared notes and @mention system |
| `backend/app/api/v1/crm_contacts_v2.py` | Enhanced contact management (v2) |
| `backend/app/api/v1/crm_custom_fields.py` | Dynamic custom field definitions |
| `backend/app/api/v1/crm_custom_objects.py` | Custom entity type management |
| `backend/app/api/v1/crm_links.py` | Cross-module link endpoints |
| `backend/app/api/v1/crm_marketing.py` | Email campaign management |
| `backend/app/api/v1/crm_pipelines.py` | Pipeline and stage configuration |
| `backend/app/api/v1/crm_reports_v2.py` | Advanced reporting and analytics |
| `backend/app/api/v1/crm_scoring.py` | AI-powered lead scoring |
| `backend/app/api/v1/crm_sequences.py` | Email sequence automation |
| `backend/app/api/v1/crm_workflows.py` | Workflow rule automation |
| `backend/app/models/crm.py` | All CRM SQLAlchemy models |
| `frontend/src/features/crm/` | All CRM frontend pages |
| `frontend/src/api/crm.ts` | CRM API client hooks |

---

## Data Models

| Model | Table | Description |
|-------|-------|-------------|
| `Contact` | `crm_contacts` | Person or organization in the CRM |
| `Lead` | `crm_leads` | Unqualified inbound inquiry |
| `Opportunity` | `crm_opportunities` | Qualified sales opportunity |
| `Deal` | `crm_deals` | Active deal in a pipeline stage |
| `Pipeline` | `crm_pipelines` | Named sales pipeline |
| `PipelineStage` | `crm_pipeline_stages` | Stage within a pipeline |
| `Activity` | `crm_activities` | Logged interaction (call, email, meeting) |
| `Campaign` | `crm_campaigns` | Email marketing campaign |
| `Sequence` | `crm_sequences` | Multi-step email sequence |
| `WorkflowRule` | `crm_workflow_rules` | Automation rule (if X then Y) |
| `CustomField` | `crm_custom_fields` | Dynamic field definition |

---

## Workflows

### Lead-to-Deal Lifecycle

```
Form Submission / Manual Entry
        ↓
    Lead (new → qualified → disqualified)
        ↓ (convert)
    Opportunity (prospecting → demo → proposal → negotiation)
        ↓ (close)
    Deal (won / lost)
        ↓
    Customer (Contact tagged as customer)
```

### Pipeline Stages (Default)

```
New Lead → Qualified → Demo Scheduled → Proposal Sent → Negotiation → Closed Won / Closed Lost
```

### AI Lead Scoring

Scores are computed automatically based on:
- Contact completeness (email, phone, company, title)
- Engagement activity (email opens, form submissions, page visits)
- Deal size and urgency signals
- Historical win rate for similar profiles

Score range: 0 (cold) to 100 (hot). Configurable thresholds trigger alerts.

---

## API Endpoints

Full reference: [docs/api/crm-api.md](../api/crm-api.md)

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/crm/contacts` | List contacts with search and filters |
| `POST` | `/crm/contacts` | Create contact |
| `GET` | `/crm/leads` | List leads |
| `POST` | `/crm/leads` | Create lead |
| `PUT` | `/crm/leads/{id}/convert` | Convert lead to deal |
| `GET` | `/crm/deals` | List deals |
| `GET` | `/crm/pipeline` | Kanban pipeline view |
| `PUT` | `/crm/deals/{id}/stage` | Move deal to different stage |
| `GET` | `/crm/reports/v2/pipeline-velocity` | Pipeline velocity report |
| `GET` | `/crm/scoring/leads` | List leads with AI scores |
| `POST` | `/crm/campaigns` | Create marketing campaign |
| `POST` | `/crm/sequences` | Create email sequence |
| `GET` | `/crm/audit/{entity_type}/{entity_id}` | Audit trail for a record |

---

## Cross-Module Integrations

| Source Module | Trigger | CRM Action |
|--------------|---------|------------|
| Forms | `form.response.submitted` | Auto-create Lead from form data |
| Mail | Email from unknown sender | Option to create Contact |
| Calendar | Meeting with external contact | Log Activity on contact |
| E-Commerce | First order from customer | Tag Contact as "customer" |
| POS | Sale to named customer | Log purchase Activity |
| Support | Ticket from contact | Link ticket to CRM Contact |

---

## Configuration

| Setting | Location | Description |
|---------|----------|-------------|
| Pipeline stages | CRM > Pipelines | Customize stage names and win probability |
| Lead scoring weights | CRM Admin > Scoring | Configure scoring factors |
| Workflow triggers | CRM > Automation | Create if-then automation rules |
| Custom fields | CRM Admin > Fields | Add fields to any entity type |
| Email sequences | CRM > Sequences | Build multi-step drip campaigns |
