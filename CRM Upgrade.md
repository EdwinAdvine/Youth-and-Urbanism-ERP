Ready for review
Select text to add comments on the plan
CRM Mega-Upgrade Plan — Salesforce + HubSpot + Zoho Hybrid
Context
The CRM module currently has 9 models, 36+ endpoints, 19 frontend pages, and 3 AI tools — covering contacts, leads, opportunities, deals, campaigns, quotes, products, and tickets. This upgrade adds enterprise-grade features borrowed from Salesforce (predictive AI agents, forecasting), HubSpot (sequences, marketing automation, service hub), and Zoho (visual workflow builder, customization, gamification) to make the CRM world-class.

MVP Phase — Enhanced Core + Sales Engagement + AI Copilot
New Models (add to backend/app/models/crm.py)
Model	Table	Purpose
ContactNote	crm_contact_notes	Notes/calls/emails logged against contacts
CustomFieldDefinition	crm_custom_field_definitions	User-defined fields for any CRM entity
DuplicateCandidate	crm_duplicate_candidates	Detected duplicate contact pairs
LeadScoringRule	crm_lead_scoring_rules	Configurable scoring rules (replaces hardcoded)
SalesActivity	crm_sales_activities	Unified activity log (email/call/meeting/task)
Pipeline	crm_pipelines	Multiple named pipelines with custom stages
SalesSequence	crm_sales_sequences	Automated outreach sequences
SequenceStep	crm_sequence_steps	Individual steps in a sequence
SequenceEnrollment	crm_sequence_enrollments	Contact enrollment tracking
EmailTemplate	crm_email_templates	Reusable email/SMS templates
Column Additions to Existing Models
Contact — add: website, industry, annual_revenue, employee_count, lifecycle_stage (subscriber/lead/mql/sql/opportunity/customer/evangelist), last_activity_at, custom_fields (JSON), social_profiles (JSON), score (0-100)

Lead — add: score, score_factors (JSON), scored_at, custom_fields (JSON)

Opportunity — add: pipeline_id (FK→crm_pipelines), swimlane, weighted_value, loss_reason, custom_fields (JSON)

New Backend Routers (all under /crm prefix)
Router File	Endpoints	Purpose
crm_contacts_v2.py	7	360-view, notes CRUD, duplicate detect/merge/dismiss
crm_custom_fields.py	4	Custom field definition CRUD
crm_scoring.py	7	Scoring rules CRUD + batch re-score + single score
crm_pipelines.py	6	Multi-pipeline CRUD + board view + what-if forecast
crm_activities.py	4	Sales activity CRUD
crm_sequences.py	10	Sequence CRUD + activate/pause + enroll/unenroll
crm_templates.py	6	Email template CRUD + preview with merge fields
New Backend Services
Service File	Purpose
services/crm_duplicates.py	Duplicate detection (email exact=90, name+company fuzzy=70, phone=80) + merge logic
services/crm_scoring.py	Rule-based scoring engine, loads LeadScoringRule, evaluates against lead+contact fields
services/crm_sequences.py	Sequence execution engine — Celery hourly task processes enrollments, executes steps
Existing Files to Modify
File	Changes
backend/app/models/crm.py	Add columns to Contact/Lead/Opportunity + 10 new model classes
backend/app/api/v1/__init__.py	Register 7 new routers
backend/app/api/v1/crm.py	Add pipeline_id param to pipeline view, loss_reason to close-lost, custom_fields to schemas
backend/app/main.py	Register event handlers: contact.created→duplicate detection, lead.created→auto-score
backend/app/tasks/celery_app.py	Add process_sequence_enrollments (hourly) + rescore_all_leads (daily) beat tasks
backend/app/services/ai_tools.py	Modify score_lead to use new rule engine; add enroll_in_sequence, suggest_duplicates, summarize_contact_360 tools
frontend/src/api/crm.ts	Add score/custom_fields/lifecycle_stage to Contact/Lead/Opportunity types
frontend/src/features/crm/PipelinePage.tsx	Add swimlane toggle, pipeline selector dropdown, enhanced DealCard
frontend/src/features/crm/CRMDashboard.tsx	Add lead score distribution, activity feed widget, sequence stats
frontend/src/features/crm/ContactDetail.tsx	Evolve into 360-degree view with tabs
Frontend route file (App.tsx)	Add ~10 new CRM routes
New Frontend Files
Pages:

Contact360Page.tsx — Tabbed 360-view (Overview, Activities, Notes, Deals, Campaigns, Files)
DuplicatesPage.tsx — Duplicate candidates list with merge/dismiss
CustomFieldsPage.tsx — Admin: manage custom field definitions
LeadScoringPage.tsx — Admin: scoring rules with weight sliders
SequencesPage.tsx — List/manage sales sequences
SequenceBuilderPage.tsx — Visual step builder (email→wait→task→condition)
TemplatesPage.tsx — Email template management with preview
ActivitiesPage.tsx — Global activity feed/log
PipelinesSettingsPage.tsx — Manage multiple pipelines and stages
Components:

components/DealCard.tsx — Enhanced pipeline card (score badge, activities, next action)
components/SwimlaneBoard.tsx — Board with swimlane grouping (by owner/priority/source)
components/ActivityTimeline.tsx — Reusable activity timeline
components/ContactMergeDialog.tsx — Side-by-side field comparison for merge
components/LeadScoreIndicator.tsx — Color-coded 0-100 score badge
components/CustomFieldRenderer.tsx — Dynamic form renderer for custom fields
components/SequenceStepEditor.tsx — Step config editor
API Client:

frontend/src/api/crm_v2.ts — TanStack Query hooks for all new MVP endpoints
Alembic Migration
Single migration: crm_mvp_upgrade — adds columns to 3 tables, creates 10 new tables, adds indexes on email/lifecycle_stage/activity contact_id/enrollment status.

Phase 2 — Marketing Hub + Service Hub + Automations + Reporting
New Model Files
backend/app/models/crm_marketing.py:

EmailCampaignConfig — A/B test config (subject_line_a/b, ab_test_ratio, winner_metric, engagement counts)
Segment — Static/dynamic contact segments with JSON filter rules + AI-suggested flag
SegmentContact — Static segment membership
ContentCalendarItem — Content planning (email_campaign/social_post/blog/event)
Unsubscribe — Contact unsubscribe tracking
backend/app/models/crm_service.py:

Conversation — Omnichannel inbox (email/chat/phone/social/web_form)
ConversationMessage — Messages within conversations (customer/agent/system/ai sender types)
KnowledgeBaseArticle — KB articles with pgvector embedding for semantic search
SLAPolicy — SLA definitions per priority (first_response_hours, resolution_hours)
SLATracker — Per-ticket SLA tracking with breach flags
backend/app/models/crm_automations.py:

Workflow — Visual workflow definitions (event/schedule/manual/webhook triggers)
WorkflowNode — Canvas nodes (trigger/action/condition/delay/branch) with x/y positions
WorkflowExecution — Execution history with steps log
WorkflowTemplate — Pre-built workflow templates
backend/app/models/crm_reports.py:

SavedReport — User-saved report configs (pipeline_funnel/cohort/leaderboard/custom)
DashboardWidget — Drag-and-drop dashboard widgets with position/size
GamificationScore — Per-user periodic scores (deals closed, activities, leads converted)
CRMTicket column additions: channel, sla_policy_id (FK), first_response_at, tags (ARRAY)

New Backend Routers
Router	Key Endpoints
crm_marketing.py	A/B test setup/results, segments CRUD + compute + AI-suggest, content calendar CRUD, unsubscribes
crm_service.py	Conversations CRUD + messages + assign/resolve, KB articles CRUD + semantic search, SLA policies CRUD + per-ticket SLA
crm_workflows.py	Workflow CRUD + activate/pause/test + execution history, workflow templates + clone
crm_reports_v2.py	Funnel/cohort/leaderboard reports, AI insights, saved reports, dashboard widgets CRUD, gamification scores
New Backend Services
Service	Purpose
crm_workflow_engine.py	Event-driven execution: walk node graph, execute actions (send_email/update_field/create_task/notify/webhook), log steps
crm_gamification.py	Celery daily task: compute gamification scores (deal value/100 + activity5 + lead_converted20)
crm_kb_embeddings.py	Generate embeddings via Ollama on article create/update, pgvector cosine similarity search
New Frontend Pages
marketing/EmailCampaignBuilder.tsx — Drag-and-drop email builder
marketing/ABTestSetup.tsx — A/B test configuration
marketing/SegmentBuilder.tsx — Visual segment rule builder
marketing/ContentCalendarPage.tsx — Calendar view for content planning
service/ConversationInbox.tsx — Omnichannel inbox (list + chat panel)
service/KnowledgeBasePage.tsx — Article list + editor
service/SLAPoliciesPage.tsx — SLA config
automations/WorkflowListPage.tsx — Workflow list
automations/WorkflowCanvasPage.tsx — Visual workflow builder (use @xyflow/react library)
reports/DashboardBuilderPage.tsx — Drag-and-drop dashboard
reports/FunnelReportPage.tsx — Funnel analysis
reports/CohortReportPage.tsx — Cohort analysis
reports/LeaderboardPage.tsx — Gamification leaderboard
Phase 3 — AI Agents + Custom Objects + Enterprise
New Model Files
backend/app/models/crm_ai_agents.py:

CRMAIAgentConfig — Agent type configs (lead_qualifier/meeting_scheduler/ticket_resolver/report_generator), with tool allowlist, approval settings, max_actions_per_run
CRMAIAgentRun — Agent run history with input/output/actions_taken
backend/app/models/crm_custom_objects.py:

CustomObjectDefinition — User-defined entity types with field schemas + relationship defs
CustomObjectRecord — JSON-based records for custom objects
CustomObjectRelationship — Polymorphic relationships to standard + custom entities
backend/app/models/crm_collaboration.py:

Comment — Threaded comments on any CRM entity (polymorphic via entity_type+entity_id)
RecordFollower — Follow records for change notifications
backend/app/models/crm_audit.py:

AuditLog — Field-level change tracking (entity_type, entity_id, action, old/new JSON, user, IP)
New Backend Routers
crm_ai_agents.py — Agent config CRUD, manual trigger, run history, approval, churn/upsell prediction
crm_custom_objects.py — Definition CRUD, record CRUD, relationship management
crm_collaboration.py — Comments CRUD, follow/unfollow, followed records list
crm_audit.py — Audit log list (admin), per-entity history
New Backend Services
crm_ai_agents.py — Leverages existing Urban Bad AI orchestrator; per-agent-type system prompts + tool allowlists; Celery beat for scheduled agents
New Frontend Pages
ai/AIAgentConfigPage.tsx — Manage AI agent configs
ai/AIAgentRunsPage.tsx — View runs + approve pending actions
ai/AICopilotPanel.tsx — Contextual suggestions sidebar
custom-objects/CustomObjectListPage.tsx — Define custom object types
custom-objects/CustomObjectRecordsPage.tsx — Browse/CRUD records
custom-objects/CustomObjectFormBuilder.tsx — Visual form/layout builder
components/CommentsThread.tsx — Threaded comments (reusable across all entities)
components/MentionsInput.tsx — @mention input
AuditLogPage.tsx — Admin audit trail viewer
Dependencies to Install
Frontend: npm install @xyflow/react (for Phase 2 workflow canvas builder)
Implementation Order (All 3 Phases)
MVP Phase
Alembic migration: crm_mvp_upgrade (10 new tables + column additions to Contact/Lead/Opportunity)
Models in crm.py (add columns + 10 new classes)
Services: crm_scoring.py, crm_duplicates.py, crm_sequences.py
Routers: crm_custom_fields, crm_scoring, crm_pipelines, crm_activities, crm_contacts_v2, crm_sequences, crm_templates
Register 7 routers in __init__.py + event handlers in main.py
Celery tasks for scoring + sequences
AI tool enhancements in ai_tools.py
Frontend API client (crm_v2.ts)
Frontend pages: Contact360, Pipelines, Scoring, Sequences, Duplicates, Activities, Templates
Modify existing: PipelinePage, CRMDashboard, ContactDetail, App.tsx routes
Phase 2
Alembic migration: crm_phase2_marketing_service (16 new tables + CRMTicket columns)
Model files: crm_marketing.py, crm_service.py, crm_automations.py, crm_reports.py
Services: crm_workflow_engine.py, crm_gamification.py, crm_kb_embeddings.py
Routers: crm_marketing, crm_service, crm_workflows, crm_reports_v2
Register 4 routers + event handlers + Celery tasks (gamification daily, SLA breach check hourly)
npm install @xyflow/react
Frontend API clients: crm_marketing.ts, crm_service.ts, crm_workflows.ts, crm_reports_v2.ts
Frontend pages: marketing/ (4), service/ (3), automations/ (2 incl. WorkflowCanvasPage with @xyflow/react), reports/ (4)
Modify existing: TicketsPage (add channel/SLA), CampaignsPage (add A/B test), CRMDashboard (add widgets)
Phase 3
Alembic migration: crm_phase3_ai_custom_collab (7 new tables)
Model files: crm_ai_agents.py, crm_custom_objects.py, crm_collaboration.py, crm_audit.py
Service: crm_ai_agents.py (leverages existing Urban Bad AI orchestrator)
Routers: crm_ai_agents, crm_custom_objects, crm_collaboration, crm_audit
Register 4 routers + audit logging middleware + event handlers (comment.mention→notify, record.changed→notify followers)
Frontend API clients: crm_ai_agents.ts, crm_custom_objects.ts, crm_collaboration.ts
Frontend pages: ai/ (3), custom-objects/ (3), components/CommentsThread + MentionsInput, AuditLogPage
Integrate CommentsThread into Contact360, DealPage, TicketsPage (all entity detail views)
Verification
Backend: docker compose exec backend pytest tests/test_crm*.py -v
Migration: docker compose exec backend alembic upgrade head — verify no errors
Frontend: cd frontend && npx tsc --noEmit — no type errors
Manual: Navigate to CRM in browser at localhost:3010, verify:
Contact 360 view loads with tabs
Multiple pipelines with swimlane toggle work
Lead scoring rules can be created and leads re-scored
Sales sequences can be built with steps and contacts enrolled
Duplicate detection finds and allows merge/dismiss
Email templates render with merge field preview
API: Swagger at localhost:8010/docs — verify all new /crm/* endpoints appear