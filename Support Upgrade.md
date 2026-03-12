Ready for review
Select text to add comments on the plan
Urban ERP Support — Zendesk Enterprise-Beating Upgrade Plan
Context
The Support module currently has 9 models, 66 endpoints, 11 frontend pages, 5 AI tools, and basic cross-module links (CRM + Projects). It handles core ticketing (auto-numbered TKT-YYYY-NNNN), SLA tracking with breach flags, knowledge base, CSAT surveys, canned responses, JSON-based routing rules, and a KPI dashboard. This is a solid foundation — roughly comparable to Freshdesk Free/Growth tier.

This upgrade transforms it into an AI-native, omnichannel support platform that beats Zendesk Suite Enterprise by leveraging our unfair advantage: native access to Finance, HR, E-Commerce, CRM, and Supply Chain data without any third-party integrations.

1. GAP ANALYSIS (23 Zendesk Enterprise Features)
#	Feature	Status	How We Beat Competition
1	Omnichannel Ticket Submission (email, chat, WhatsApp, social, voice)	Partial — web forms only	Add: email-to-ticket via Stalwart IMAP polling, WebSocket live chat, webhook-based channel abstraction for WhatsApp/social. Self-hosted = zero per-message fees vs Zendesk's metered pricing
2	Customizable & Dynamic Ticket Forms	No	Ticket templates + dynamic forms engine (reuse existing Forms module). Conditional fields, custom field types, auto-prefill from customer CRM record
3	AI Chatbots & Autonomous Agents	No	Ollama-powered chatbot with KB RAG + pgvector similarity search. Zero API cost vs Zendesk AI add-on ($50/agent/mo). Bot auto-resolves FAQs, escalates to human when confidence < threshold
4	Intelligent AI Routing & Auto-Categorization	Partial — keyword-based routing rules	Upgrade: Ollama embeddings + pgvector similarity against historical tickets for classification. Skill-based routing + round-robin + load balancing. Agent availability from HR shift schedule
5	Automated Workflows, Triggers, Macros	Partial — basic routing rules only	Full if/then automation engine: trigger on any event, evaluate conditions, execute chains of actions (assign, tag, email, change priority, add note). Visual builder UI
6	Self-Service Help Center / Knowledge Base	Yes — articles with search, helpful voting	Enhance: AI-powered conversational search (natural language → synthesized answers), interactive troubleshooting trees, auto-suggest articles as customer types ticket description
7	Customer Self-Service Portal	No	Separate /portal/* route tree: customer registration/login, view own tickets, add comments, search KB, participate in community forums. No separate product needed
8	AI Copilot for Agents	Partial — suggest_response AI tool exists	Full copilot sidebar in TicketDetail: suggested response (sentiment-aware tone), similar resolved tickets, customer 360 (CRM + Finance + E-Commerce data), KB article suggestions, response quality scorer
9	SLA Management & Escalations	Partial — SLA tracking + breach flags exist, no auto-escalation	Add: multi-level escalation chains (notify → reassign → escalate to manager), SLA pause on "waiting_on_customer", Celery-based auto-escalation, predictive SLA breach alerts (4h early warning)
10	Custom Reports & Analytics	Partial — basic KPI dashboard + CSAT report	Add: daily analytics snapshots, time-series trends, agent leaderboards, channel performance comparison, AI deflection rate, cost-per-ticket from Finance/HR, forecast ticket volume
11	CSAT, NPS & Feedback Surveys	Yes — 1-5 rating + feedback + satisfaction report	Enhance: auto-send CSAT survey 24h after resolution (Celery task), NPS calculation, branching surveys, sentiment overlay, follow-up automation on low scores
12	Native Mobile Apps	No	Responsive PWA for agents + customers (React, already mobile-responsive). Native push notifications via service worker. Mobile-optimized ticket detail + live chat
13	Deep Integrations & API Access	Partial — CRM link + project escalation	The killer advantage: native queries to Finance (invoices, payments), E-Commerce (orders, returns), HR (agent schedules, hourly rates), Supply Chain (PO delays). No REST → webhook → sync lag
14	Collaboration: Internal Notes, @Mentions, Collision Detection	Partial — internal comments exist	Add: @mention parsing with notification dispatch, Redis-based collision detection ("Agent X is viewing/typing"), ticket followers/watchers with notification preferences
15	Sentiment Analysis & Auto-Priority	No	Ollama sentiment on every comment (-1 to +1 score + emotion tags). Auto-escalate when sentiment drops below threshold. Sentiment trend visible per ticket + per customer
16	Proactive Support & Outreach	No	Event-driven proactive rules: supply chain PO delayed → notify affected customers before they complain. Invoice overdue → auto-create billing support ticket. E-commerce order delayed → proactive outreach
17	Custom Roles, Permissions & Teams	Partial — RBAC exists (Super Admin / App Admin / User)	Already strong. Add: support-specific roles (Agent, Senior Agent, Team Lead, Support Manager) with granular permissions (view_internal_notes, manage_automations, view_analytics)
18	Sandbox Environment	No	Config sandboxes: snapshot current routing rules + automations + SLA policies, test changes in isolation, promote to production. Version control for support config
19	Compliance, Encryption & Audit Logs	No — no audit trail	TicketAuditLog model tracking every field change (who, what, when, old/new value, IP). Data retention policies. Already self-hosted = full data sovereignty
20	Voice Support with IVR & Call Recording	No	Jitsi SIP integration for inbound/outbound calls. Ollama Whisper for transcription. Auto-create ticket from call. Sentiment analysis on voice transcription. MinIO storage for recordings
21	Community Forums	No	ForumCategory → ForumPost → ForumReply with upvotes + best-answer marking. Agent can convert forum post to ticket. AI auto-suggests KB answers on new posts
22	Ticket Summarization & Insights	Partial — AI suggest_response exists	Add: auto-summarize long threads for agent handoff, root cause clustering (group similar tickets), KB gap detection (topics with many tickets but no articles)
23	Agent Performance & Workforce Management	Partial — basic agent metrics exist	Add: time tracking per ticket (start/stop timer, billable flag), agent skills matrix, shift scheduling (integrate with HR), burnout detection (handle time + sentiment patterns), leaderboards
2. MODERN AI-ERA ENHANCEMENTS (2026)
Ticket Intake
AI Pre-fill — As customer types subject, pgvector similarity search suggests category, tags, and links to similar resolved tickets in real-time
Screenshot AI Analysis — Customer uploads screenshot; Ollama vision model extracts error text, suggests category, pre-fills description
Voice-to-Ticket — Customer speaks into microphone; Whisper transcription creates ticket automatically with AI-classified priority
Automation & Workflows
AI Automation Suggestions — Analyze 30 days of agent actions; suggest rules ("You manually escalate 'production down' tickets — want to automate this?")
Predictive SLA Management — AI predicts which tickets will breach SLA 4 hours early, auto-reassigns to available agents
Self-healing Workflows — Automation engine detects failed actions and retries with alternative paths
Agent Experience
AI Response Co-pilot — As agent types, AI completes sentences, suggests tone adjustments, flags compliance issues
Cross-ticket Intelligence — Sidebar shows "5 similar tickets resolved by restarting API gateway" with one-click apply
Agent Burnout Detection — Track handle time, response sentiment, break patterns; alert managers
Self-Service & Knowledge Base
Conversational KB Search — Customer asks in natural language; AI searches KB + past tickets and synthesizes answer (not keyword match)
Interactive Troubleshooting Trees — AI generates step-by-step flows from KB articles; customer follows wizard, creates ticket only if unresolved
Community Auto-Answer — Forum post matching KB article → AI auto-posts suggested answer with source link
Analytics & Insights
Predictive Customer Churn — Correlate ticket patterns + CRM lifecycle stage to predict churn risk
Cost-per-Ticket with Finance — Real cost = (agent_hours × hourly_rate_from_HR) + (AI_tokens × cost_rate). Finance module receives cost journal entries
AI Anomaly Detection — Alert when ticket volume spikes 2x vs same day last week, auto-scale routing
Integrations & Compliance
Bi-directional CRM Sync — Support sentiment feeds into CRM contact health score; CRM deal stage changes trigger proactive support
E-Commerce Order Intelligence — Auto-pull latest orders, shipment status, return history when customer creates ticket
Finance Billing Context — Show overdue invoices, payment history, credit status alongside billing tickets
3. PHASED IMPLEMENTATION ROADMAP
Phase 1 — MVP (8 Weeks): Core Infrastructure + AI + Live Chat + Era Integration
New Models — backend/app/models/support_phase1.py
Model	Key Fields	Purpose
LiveChatSession	visitor_id, contact_id, agent_id, channel, status (queued/active/waiting/closed), ticket_id (nullable), metadata JSON	Real-time chat sessions
LiveChatMessage	session_id, sender_type (visitor/agent/bot), content, content_type (text/image/file/system), attachments JSON	Chat messages
TicketAuditLog	ticket_id, user_id, action, field_name, old_value, new_value, ip_address	Full change audit trail
TicketTimeEntry	ticket_id, agent_id, started_at, ended_at, duration_seconds, is_billable, billing_rate_hourly, note	Time tracking per agent
SavedTicketView	user_id, name, filters JSON, columns JSON, sort_by, sort_order, is_shared, is_default	Saved filter views
TicketTemplate	name, default_subject, default_priority, default_category_id, custom_fields JSON, form_id (FK forms), is_active	Ticket creation templates
InboundEmailRule	email_address, category_id, priority, assign_to, auto_reply_template_id, is_active	Email-to-ticket routing
Redis-backed (no SQL): AgentPresence — support:presence:{user_id} → {"status": "online|away|busy", "viewing_ticket_id": "...", "typing_ticket_id": "...", "last_seen": "iso"} with 60s TTL heartbeat

Columns added to existing Ticket model:

channel String(30) default "web" — track source channel
sentiment_score Float nullable — AI sentiment (-1 to 1)
sentiment_label String(30) nullable — frustrated/confused/satisfied/angry
custom_fields JSON nullable — template-driven custom data
New Endpoints
File	Prefix	Key Routes
support_livechat.py	/support	POST /live-chat/sessions, GET /live-chat/sessions, POST /{id}/assign, POST /{id}/transfer, POST /{id}/close, POST /{id}/convert-to-ticket, WebSocket /support/live-chat/ws/{session_id}
support_audit.py	/support	GET /tickets/{id}/audit-log, GET /audit-log (global with filters)
support_time.py	/support	POST /tickets/{id}/time/start, POST /tickets/{id}/time/stop, GET /tickets/{id}/time, PUT /time-entries/{id}, GET /time/report
support_views.py	/support	GET /views, POST /views, PUT /views/{id}, DELETE /views/{id}, GET /views/{id}/tickets
support_templates.py	/support	GET /templates, POST /templates, PUT /templates/{id}, DELETE /templates/{id}, POST /templates/{id}/apply
support_presence.py	/support	POST /presence/heartbeat, GET /presence/agents, GET /presence/ticket/{id}, POST /presence/typing/{id}
support_inbound.py	/support	GET /inbound-email/rules, POST /inbound-email/rules, PUT /{id}, DELETE /{id}, POST /inbound-email/process
Modify existing support.py:

add_comment → parse @mentions, publish support.mention event
get_ticket → return X-Viewing-Agents header from Redis presence
All mutation endpoints → write TicketAuditLog entry
Celery Tasks — backend/app/tasks/support_tasks.py
Task	Schedule	Description
poll_inbound_emails	Every 2 min	Connect to Stalwart IMAP, fetch unread from support mailboxes, create tickets via InboundEmailRule matching, send auto-reply
check_sla_escalations	Every 5 min	Find tickets approaching SLA breach, publish support.sla.warning, auto-escalate if breached
send_csat_survey	Event-triggered	24h after ticket resolved, send CSAT email to customer
ai_classify_new_ticket	Event-triggered	On support.ticket.created, run Ollama classification for priority/category/sentiment
Event Bus — New Channels (register in main.py lifespan)
support.ticket.resolved → queue CSAT survey after 24h delay
support.ticket.assigned → notify assignee via email + in-app
support.ticket.escalated → notify manager
support.sla.warning → SLA approaching breach (configurable threshold)
support.sla.breached → trigger escalation chain
support.mention → notify mentioned user
support.livechat.queued → alert available agents
support.comment.added → email customer (external comments only)
AI Enhancements — Add to backend/app/services/ai_tools.py
Tool	Approval Tier	Description
auto_classify_ticket	auto_approve	Ollama embeddings + pgvector similarity against historical tickets (replaces keyword-based classify_ticket)
sentiment_analyze	auto_approve	Analyze text for sentiment score (-1 to 1) + emotion tags
ai_suggest_kb_articles	auto_approve	pgvector embedding similarity to find top-3 relevant KB articles
ai_draft_response	auto_approve	Enhanced: includes CRM customer history, past tickets, sentiment-aware tone
ai_summarize_thread	auto_approve	Summarize long ticket threads for agent handoff
ai_detect_intent	auto_approve	Classify: billing_issue, bug_report, feature_request, how_to, complaint, praise
Frontend Pages — frontend/src/features/support/
Page	Description
LiveChatDashboard.tsx	Agent view: chat queue, active sessions, accept/transfer
LiveChatWindow.tsx	Chat UI: message list, typing indicator, file upload, canned response picker, AI suggest
TicketAuditLog.tsx	Timeline view of all ticket changes
TimeTrackingPanel.tsx	Component in TicketDetail sidebar: start/stop timer, entries list, billable toggle
SavedViewsPage.tsx	Manage saved ticket filter views
TicketTemplatesPage.tsx	CRUD for ticket creation templates
AgentStatusBar.tsx	Shared component: online agents, collision detection, typing indicators
InboundEmailConfig.tsx	Admin: configure support email addresses + routing rules
New API client: frontend/src/api/support_livechat.ts — hooks for live chat, presence, templates, views, time tracking, audit log

New hook: frontend/src/hooks/useLiveChatWebSocket.ts — WebSocket with auto-reconnect, typing indicators, message streaming

Modified pages:

TicketDetail.tsx — Add: time tracking sidebar, audit log tab, @mention autocomplete, collision detection banner, sentiment badge per comment
TicketsPage.tsx — Add: saved views dropdown, template selection for new ticket
SupportDashboard.tsx — Add: live chat queue widget, agent online count, real-time counters
Alembic Migration
support_phase1 — Create 7 new tables + add 4 columns to tickets

Phase 2 — Full Power (Months 2–4): AI Copilot, Automation Engine, Self-Service Portal, Omnichannel
New Models — backend/app/models/support_phase2.py
Model	Key Fields	Purpose
SupportAutomation	name, trigger_event, conditions JSON, actions JSON, is_active, execution_count	If/then workflow engine
SupportAutomationLog	automation_id, ticket_id, actions_executed JSON, success, error_message	Automation audit trail
CustomerPortalAccount	contact_id (FK crm_contacts), email, password_hash, display_name, is_active	Customer self-service login
ForumCategory	name, slug, description, sort_order	Community forum structure
ForumPost	category_id, author_id, author_type, title, content, is_pinned, view_count, upvote_count	Forum questions
ForumReply	post_id, author_id, content, is_best_answer, upvote_count	Forum answers
SLAEscalationChain	sla_policy_id, level (1-3), trigger_minutes_before_breach, action (notify/reassign), target_user_id	Multi-level escalation
OmnichannelConfig	channel (whatsapp/facebook/sms), webhook_url, api_key_encrypted, settings JSON	Channel configuration
TicketFollower	ticket_id, user_id, notify_on_comment, notify_on_status_change	Ticket watchers
New Endpoints
File	Key Routes
support_automation.py	CRUD automations, POST /{id}/test (dry-run), GET /{id}/logs, POST /evaluate (manual trigger)
support_portal.py (prefix /portal)	Customer auth (register/login), GET /tickets (own), POST /tickets, POST /tickets/{id}/comments, GET /kb, GET /kb/{slug}
support_forum.py	CRUD categories/posts/replies, POST /{id}/upvote, POST /replies/{id}/best-answer
support_omnichannel.py	CRUD channels, POST /channels/webhook/{channel} (inbound receiver)
Additions to support.py	POST /tickets/{id}/followers, DELETE /tickets/{id}/followers/{user_id}, GET /tickets/{id}/followers
AI Copilot Tools
Tool	Description
ai_auto_triage	Full triage in one call: classify + prioritize + route + suggest response
ai_customer_360	Pull context from CRM + Finance (invoices) + E-Commerce (orders) + past tickets
ai_escalation_predictor	Predict likelihood of escalation from sentiment trajectory + similar historical tickets
ai_response_quality_scorer	Score agent drafts for tone, completeness, accuracy before sending
ai_generate_macro	Analyze repetitive agent actions → suggest automation rules
ai_translate_message	Multi-language support via Ollama
Frontend Pages
Page	Description
AutomationBuilder.tsx	Visual if/then builder: conditions + actions, drag-drop
AutomationList.tsx	Automations with enable/disable + execution stats
CustomerPortal.tsx	Separate /portal/* route: ticket list, create, view KB, community
CustomerTicketDetail.tsx	Customer-facing ticket view (simpler than agent)
ForumPage.tsx	Community forum listing
ForumPostDetail.tsx	Post + threaded replies + upvotes + best-answer
OmnichannelConfig.tsx	Admin: configure WhatsApp/social channels
SLAEscalationConfig.tsx	Configure escalation chains per SLA policy
AICopilotPanel.tsx	In TicketDetail: AI suggestions, KB articles, sentiment, customer 360
Celery Tasks
evaluate_automations — on ticket events, evaluate + execute matching automations
process_omnichannel_webhook — handle inbound social media messages
auto_close_stale_tickets — daily; close "resolved" tickets after N configurable days
generate_weekly_support_digest — weekly email to managers with KPI summary
ai_auto_respond — for simple/FAQ tickets, draft response (requires approval above confidence threshold)
Alembic Migration
support_phase2 — Create 9 new tables + add columns to tickets (source_channel_config_id, follower_count)

Phase 3 — Enterprise Polish (Months 4–6): Advanced Analytics, Proactive Support, Voice, Workforce
New Models — backend/app/models/support_phase3.py
Model	Key Fields	Purpose
SupportAnalyticsSnapshot	date (unique), total/new/resolved tickets, avg response/resolution minutes, sla_compliance_pct, csat_avg, nps_score, ai_deflection_rate, channel/agent/category breakdowns JSON	Daily materialized analytics
ProactiveRule	name, trigger_event (e.g. supplychain.po.delayed), conditions JSON, action_type, action_config JSON, cooldown_hours	Event-driven proactive outreach
VoiceCallRecord	ticket_id, caller_number, agent_id, jitsi_room_id, status, duration_seconds, recording_url (MinIO), transcription, sentiment_score	Voice support via Jitsi SIP
SupportSandbox	name, created_by, config_snapshot JSON, status (creating/active/archived), expires_at	Config sandbox testing
AgentSkill	user_id, skill_name, proficiency_level (1-5), languages ARRAY	Skills matrix for routing
AgentShift	user_id, day_of_week, start_time, end_time, timezone	Shift scheduling
New Endpoints
File	Key Routes
support_analytics_adv.py	GET /analytics/overview, /trends, /agents, /channels, /ai-impact, /customer-health, /forecast, POST /analytics/snapshot
support_proactive.py	CRUD proactive rules, GET /{id}/history, POST /proactive/trigger (manual)
support_voice.py	POST /voice/call, GET /voice/calls, GET /{id} (+ transcription), POST /{id}/transcribe, WebSocket /support/voice/ws/{call_id}
support_skills.py	CRUD agent skills/shifts, GET /routing/skill-match/{ticket_id} (best agent based on skills + availability + load)
support_sandbox.py	CRUD sandboxes, POST /{id}/activate, config snapshot/restore
AI Phase 3 Tools
ai_forecast_volume — predict ticket volume by category (time-series)
ai_customer_health_score — compute from CSAT + ticket frequency + sentiment + purchase data
ai_root_cause_analysis — cluster similar tickets to identify systemic issues
ai_kb_gap_detector — identify topics with many tickets but no KB articles
ai_voice_sentiment — real-time sentiment from voice transcription
ai_resolve_invoice_dispute — query Finance data, draft credit memo / explanation
Frontend Pages
Page	Description
AnalyticsOverview.tsx	Executive dashboard: ticket trends, SLA compliance, CSAT, channel distribution
AnalyticsAgents.tsx	Agent leaderboard + performance heatmap
AnalyticsAIImpact.tsx	AI deflection rate, time saved, accuracy metrics
ProactiveRulesPage.tsx	Configure proactive support triggers
VoiceCallPage.tsx	Call center: active calls, history, click-to-call
CallDetailPage.tsx	Recording player + transcription + sentiment timeline
AgentSkillsPage.tsx	Admin: skills matrix + proficiency management
AgentSchedulePage.tsx	Shift scheduling (integrate with HR)
SandboxPage.tsx	Config sandboxes: create, test, promote
CustomerHealthDashboard.tsx	Customer health scores with drill-down
Celery Tasks
generate_daily_analytics_snapshot — 2 AM UTC daily
evaluate_proactive_rules — on cross-module events (order delayed, invoice overdue)
ai_forecast_ticket_volume — weekly prediction
transcribe_voice_recording — background after call ends
cleanup_expired_sandboxes — daily archival
Alembic Migration
support_phase3 — Create 6 new tables + add columns to tickets (ai_deflected, voice_call_id) + ticket_routing_rules (required_skills JSON, language_requirement)

4. TECHNICAL RECOMMENDATIONS
The existing stack is already excellent. Specific additions:

Layer	Current	Addition
Real-time	Redis pub/sub event bus	Add FastAPI WebSocket manager for live chat + presence (already have pattern from Agent WebSocket)
AI / Embeddings	Ollama + ai_tools.py	Add pgvector embeddings table for KB articles + ticket descriptions (similarity search)
Voice	Jitsi (already in stack)	Enable Jitsi SIP gateway for inbound/outbound voice calls
Transcription	—	Ollama Whisper model for voice-to-text
Search	PostgreSQL ILIKE	pgvector for semantic search across KB + tickets + forum
Email	Stalwart (already in stack)	Add IMAP polling Celery task for email-to-ticket
File Storage	MinIO (already in stack)	Store call recordings, chat attachments in urban-erp-files/support/ bucket prefix
No new containers or external dependencies needed. Everything runs within the existing 14-container stack.

5. FIVE "ERA SUPPORT-ONLY" COMPETITIVE DIFFERENTIATORS
1. Customer Lifetime Value-Aware Priority Routing
When a ticket arrives, the system queries Finance (total invoices paid), E-Commerce (order count, total spend), and CRM (deal pipeline value) to compute a Customer Revenue Score. High-value customers ($50K+ LTV) auto-escalate to senior agents. Zendesk needs Salesforce + Stripe + Shopify webhooks with sync lag — we query tables directly in the same database.

2. Real Cost-per-Resolution with Native Finance + HR
Each ticket computes actual cost: (agent_hours × hourly_rate_from_HR) + (AI_tokens × cost_rate). On ticket close, a Finance journal entry is auto-created. No other help desk can calculate this without custom middleware to HR payroll and accounting systems.

3. Proactive Support from Supply Chain Events
When a supply chain PO is delayed (supplychain.po.delayed event), the system auto-identifies all e-commerce orders waiting on that PO's items and proactively creates tickets or sends "Your order may be delayed" emails — before the customer notices. Impossible without native supply chain + e-commerce access.

4. AI-Powered Invoice Dispute Resolution Pipeline
Customer disputes an invoice → auto-creates ticket linked to Finance invoice → AI pulls line items, payment history, contract terms → drafts resolution (credit memo, partial refund, or explanation) → agent approves → Finance module auto-generates the credit memo. End-to-end in one system.

5. Agent Scheduling Integrated with HR Leave Calendar
Routing engine considers HR leave requests, shift schedules, and time-off patterns in real-time. Agents on PTO or outside shift hours are automatically skipped. Zendesk needs BambooHR/Workday integration that's always stale — we read the HR tables directly.

6. CRITICAL FILES TO MODIFY
File	Changes
backend/app/models/support.py	Add columns: channel, sentiment_score, sentiment_label, custom_fields to Ticket
backend/app/api/v1/support.py	Add @mention parsing, audit logging on mutations, collision detection header
backend/app/api/v1/__init__.py	Register ~8 new support sub-routers
backend/app/main.py	Register new event handlers in lifespan
backend/app/services/ai_tools.py	Add 12+ new support AI tools
backend/app/tasks/celery_app.py	Register new periodic tasks (SLA check, inbound email, analytics snapshot)
backend/app/core/integration_handlers.py	Add handlers for resolved, assigned, escalated, mention, livechat events
frontend/src/features/support/TicketDetail.tsx	Add time tracking, AI copilot sidebar, audit log tab, collision banner, sentiment badges
frontend/src/features/support/TicketsPage.tsx	Add saved views dropdown, template selection
frontend/src/features/support/SupportDashboard.tsx	Add live chat queue, agent online count, real-time counters
frontend/src/App.tsx	Add routes for ~20 new support pages + /portal/* customer portal routes
7. NEW FILES TO CREATE
Backend (Phase 1)
backend/app/models/support_phase1.py — 7 new models
backend/app/api/v1/support_livechat.py — Live chat + WebSocket
backend/app/api/v1/support_audit.py — Audit log endpoints
backend/app/api/v1/support_time.py — Time tracking endpoints
backend/app/api/v1/support_views.py — Saved views endpoints
backend/app/api/v1/support_templates.py — Ticket templates endpoints
backend/app/api/v1/support_presence.py — Agent presence endpoints
backend/app/api/v1/support_inbound.py — Inbound email config
backend/app/tasks/support_tasks.py — Support-specific Celery tasks
Backend (Phase 2)
backend/app/models/support_phase2.py — 9 new models
backend/app/api/v1/support_automation.py — Workflow automation engine
backend/app/api/v1/support_portal.py — Customer self-service portal
backend/app/api/v1/support_forum.py — Community forum endpoints
backend/app/api/v1/support_omnichannel.py — Channel management
Backend (Phase 3)
backend/app/models/support_phase3.py — 6 new models
backend/app/api/v1/support_analytics_adv.py — Advanced analytics
backend/app/api/v1/support_proactive.py — Proactive support rules
backend/app/api/v1/support_voice.py — Voice support + Jitsi SIP
backend/app/api/v1/support_skills.py — Agent skills + workforce
backend/app/api/v1/support_sandbox.py — Config sandboxes
Frontend (Phase 1)
frontend/src/features/support/LiveChatDashboard.tsx
frontend/src/features/support/LiveChatWindow.tsx
frontend/src/features/support/TicketAuditLog.tsx
frontend/src/features/support/TimeTrackingPanel.tsx
frontend/src/features/support/SavedViewsPage.tsx
frontend/src/features/support/TicketTemplatesPage.tsx
frontend/src/features/support/AgentStatusBar.tsx
frontend/src/features/support/InboundEmailConfig.tsx
frontend/src/api/support_livechat.ts
frontend/src/hooks/useLiveChatWebSocket.ts
Frontend (Phase 2)
frontend/src/features/support/AutomationBuilder.tsx
frontend/src/features/support/AutomationList.tsx
frontend/src/features/support/CustomerPortal.tsx
frontend/src/features/support/CustomerTicketDetail.tsx
frontend/src/features/support/ForumPage.tsx
frontend/src/features/support/ForumPostDetail.tsx
frontend/src/features/support/OmnichannelConfig.tsx
frontend/src/features/support/SLAEscalationConfig.tsx
frontend/src/features/support/AICopilotPanel.tsx
frontend/src/api/support_portal.ts
frontend/src/api/support_forum.ts
Frontend (Phase 3)
frontend/src/features/support/AnalyticsOverview.tsx
frontend/src/features/support/AnalyticsAgents.tsx
frontend/src/features/support/AnalyticsAIImpact.tsx
frontend/src/features/support/ProactiveRulesPage.tsx
frontend/src/features/support/VoiceCallPage.tsx
frontend/src/features/support/CallDetailPage.tsx
frontend/src/features/support/AgentSkillsPage.tsx
frontend/src/features/support/AgentSchedulePage.tsx
frontend/src/features/support/SandboxPage.tsx
frontend/src/features/support/CustomerHealthDashboard.tsx
8. VERIFICATION
After each phase:

docker compose exec backend alembic upgrade head — migration applies cleanly
GET /api/v1/health → 200 OK
Swagger UI at http://localhost:8010/docs — all new endpoints visible and testable
Frontend: navigate to each new page, verify TanStack Query data loads
Phase 1 smoke test: Create ticket via web form → verify audit log entry + SLA timer + email notification. Open live chat → agent accepts → messages flow via WebSocket. Verify @mention notification dispatches.
Phase 2 smoke test: Create automation rule → trigger event → verify automation executes. Customer portal: register → login → create ticket → view own tickets. Forum: create post → reply → upvote → mark best answer.
Phase 3 smoke test: Run daily analytics snapshot → verify dashboard populates. Configure proactive rule for supplychain.po.delayed → simulate event → verify proactive ticket created. Initiate voice call → verify recording stored in MinIO → transcription completes.
9. IMPLEMENTATION ORDER (Within Each Phase)
Phase 1 (8 weeks)
Week 1-2: Models + Alembic migration + audit logging on all existing mutations
Week 2-3: Live chat WebSocket + presence system (Redis)
Week 3-4: Email-to-ticket (Stalwart IMAP polling) + inbound email rules
Week 4-5: AI enhancements (embeddings, sentiment, intent detection)
Week 5-6: Time tracking + saved views + ticket templates
Week 6-7: Frontend pages (LiveChat, AuditLog, TimeTracking, Views, Templates)
Week 7-8: Modify TicketDetail.tsx (collision detection, @mentions, sentiment badges) + integration testing
Phase 2 (Months 2-4)
Automation engine (models + evaluation logic + visual builder UI)
Customer portal (auth + ticket CRUD + KB access)
AI Copilot panel (customer 360, response scorer, auto-triage)
SLA escalation chains + auto-escalation Celery task
Community forums (categories, posts, replies, upvotes)
Omnichannel config + webhook receiver
Ticket followers + notification preferences
Phase 3 (Months 4-6)
Analytics snapshots + executive dashboard + trends
Proactive support rules + cross-module event handlers
Agent skills + shift scheduling + skill-based routing
Voice support (Jitsi SIP + transcription + recording)
Config sandboxes
Customer health dashboard + AI forecasting