Ready for review
Select text to add comments on the plan
Era Mail Upgrade Plan — Beat Microsoft Outlook Desktop 2026
Context
Era Mail is the mail module inside Urban ERP. It currently has a solid foundation (~2,700 lines backend, ~1,500 lines frontend) with basic email, labels, rules, signatures, read receipts, search, snooze, threading, and cross-module integrations (Mail→Drive, Mail→CRM, Mail→Projects, Mail→Notes). However, it falls short of Microsoft Outlook Desktop 2026 in several critical areas: no rich text editor (compose is a plain <textarea>), no file attachment upload, no offline support, no real-time push, no full-text search, no shared inboxes, no AI triage, no DLP/compliance, and no calendar scheduling from mail. This plan upgrades Era Mail to match and decisively beat Outlook by leveraging deep integration with the entire Era ecosystem (Finance, CRM, Projects, HR, Support, Supply Chain, Manufacturing, POS).

PART 1: GAP ANALYSIS (21 Feature Areas)
1. Multi-Account Support with Focused Inbox and Unified Views
Status: NO
What exists: Single-account only. MailboxMessage.user_id ties messages to one user.
Gap: No external account connections (Gmail, Outlook, Yahoo via IMAP/OAuth2), no Focused Inbox classification, no unified view.
Plan to beat Outlook:
New model MailAccount (provider, oauth_tokens encrypted, imap/smtp config, sync_enabled)
Add account_id FK to MailboxMessage
Celery task sync_external_account using aioimaplib for IMAP IDLE + periodic fetch
New model FocusedInboxScore — AI + CRM-aware sender scoring (senders with open deals/tickets score higher)
Frontend: account selector tabs in sidebar, "Focused" / "Other" tabs in message list
Era edge: Focused Inbox uses CRM deal data + support ticket status — Outlook has no CRM integration
2. Advanced Email Rules, Quick Steps, Automation, and Conditional Formatting
Status: PARTIAL
What exists: MailRule model (conditions/actions JSONB, priority, stop_processing). MailFilter (Sieve-compatible). CRUD endpoints. But rules are never executed — no rule engine processes incoming messages.
Gap: No rule execution engine, no Quick Steps, no conditional formatting, no "run rule now."
Plan to beat Outlook:
New service mail_rule_engine.py — evaluates rules on incoming messages, executes actions
New model MailQuickStep (name, icon, keyboard_shortcut, actions JSONB array)
Conditional formatting: add display_format JSONB to MailboxMessage (bg_color, font_weight computed by rule engine)
"Run rule now" endpoint applies rule to existing folder
Era edge: Rule actions can trigger cross-module operations (e.g., "If email from supplier X, auto-create procurement request in Supply Chain")
3. Categories, Flags, Pinning, Snoozing, and Smart Inbox Triage
Status: PARTIAL
What exists: Labels (color+name), snooze (stores time in headers JSONB, marks read), star toggle.
Gap: No categories (cross-folder colored tags), no flag with due date/reminder, no pinning, snooze has no Celery task to unsnooze, no smart triage.
Plan to beat Outlook:
Add to MailboxMessage: is_pinned, flag_status (none/flagged/complete), flag_due_date, flag_reminder_at, category_ids JSONB
New model MailCategory (name, color, keyboard_shortcut) — distinct from labels
Celery beat tasks: check_snoozed_messages (unsnooze), check_flag_reminders (push notification)
AI triage endpoint: classify inbox into urgent/needs-reply/fyi/promotional/spam
Era edge: Triage cross-references CRM deals and support tickets for priority
4. Powerful Search, Search Folders, and Instant Filters
Status: PARTIAL
What exists: ILIKE search on subject/from/body_text. Filters: from, has_attachment, date range.
Gap: No full-text search index, no Search Folders (virtual/saved searches), no instant filter bar, no natural language search.
Plan to beat Outlook:
Add search_vector tsvector column to MailboxMessage with GIN index
Rewrite search to use ts_query with ranking, support operators: from:, to:, has:attachment, is:unread, label:, before:, after:
New model SearchFolder (name, saved query string, icon)
AI search: natural language → structured query via Ollama ("invoices from last month over $1000")
Frontend: inline filter chips, search autocomplete, "Save as Search Folder" button
Era edge: AI search understands ERP context — "emails about deal X" cross-references CRM deal names
5. Fully Integrated Calendar with Scheduling Assistant, Availability View, and Meeting Insights
Status: PARTIAL
What exists: ICS parser in mail_parser.py, mail.sent event triggers calendar integration. No inline calendar, no scheduling assistant, no availability view.
Gap: No calendar preview in mail UI, no "Find a Time" for recipients, no RSVP handling, no meeting insights.
Plan to beat Outlook:
Calendar mini-widget in mail right sidebar (today's events, collapsible)
"Schedule Meeting" button in compose → availability grid checking CalendarEvent overlaps for internal users
ICS detection banner: "Accept | Tentative | Decline" in message detail
AI meeting insights: pre-meeting summary of recent emails/CRM/projects with attendees
Era edge: Meeting prep pulls CRM deal stage, support ticket status, project milestones with attendees
6. Tasks and To-Do Integration with Due Dates, Reminders, and Prioritization
Status: PARTIAL
What exists: "Convert to Task" creates a Projects task from email. No inline task view, no flag-to-task, no reminders in mail.
Gap: No task sidebar in mail, no "My Day" view, no flag→task auto-creation, no drag-to-create.
Plan to beat Outlook:
Tasks pane (right sidebar toggle) aggregating flagged emails + project tasks
Flag with due date auto-creates lightweight task in Projects module
AI action item extraction from threads → checklist with one-click "Create Task"
Task completion checkbox marks email flag as complete
Era edge: Tasks auto-link to Projects sprints, CRM deals, and Finance budgets
7. Contacts / People Hub with Rich Profiles and Relationship Tracking
Status: PARTIAL
What exists: GET /mail/contacts extracts contacts from sent history. ContactPicker.tsx for autocomplete.
Gap: No rich profiles, no relationship tracking, no contact card popover, no CRM sync.
Plan to beat Outlook:
New model MailContactProfile (email, display_name, avatar, title, company, crm_contact_id FK, email_count, last_email_at, avg_response_time)
Contact card popover on sender hover: photo, title, last 3 emails, CRM deal status, support tickets, invoices
People Hub page: all contacts searchable, sorted by frequency
Auto-sync frequent mail contacts to CRM as leads
Era edge: Contact card shows deal pipeline stage, outstanding invoices, open support tickets — Outlook People Hub has none of this
8. AI Copilot for Drafting Replies, Summarization, Triage Actions, and Email Insights
Status: PARTIAL
What exists: POST /mail/ai-suggest-reply generates 3 reply suggestions via Ollama. No summarization, no full draft, no insights.
Gap: No thread summarization, no AI-drafted full replies, no tone analysis, no action item extraction, no smart compose.
Plan to beat Outlook:
Thread summarization endpoint + collapsible summary banner in UI
Full draft generation with Era context (AI queries Finance/CRM/Projects before drafting)
Tone checker (professional/casual/aggressive) with suggestions
Smart compose: gray ghost text autocomplete while typing
Action item extraction from threads
Email insights dashboard: response time analytics, busiest hours, top correspondents
Era edge: AI drafts reference actual ERP data — "Invoice #1234 for $5,000 was approved March 1, payment scheduled March 15"
9. Offline Access, Cached Mode, and PST/Local File Support
Status: NO
Gap: No service worker, no IndexedDB cache, no offline compose, no import/export.
Plan to beat Outlook:
Service Worker + Workbox for caching strategy
IndexedDB via Dexie.js: cache last 500 messages (configurable)
Offline compose: queue drafts in IndexedDB, send on reconnect
Delta sync endpoint: GET /mail/messages/delta?since=timestamp
Import/Export: MBOX format (open standard), EML import, PST-to-MBOX migration guide
Era edge: Offline includes cached ERP context (recent contacts, deal summaries) for offline AI suggestions
10. Custom Signatures, Email Templates, and Stationery
Status: PARTIAL
What exists: MailSignature model with text+HTML, CRUD endpoints, auto-append on send.
Gap: No email templates, no merge field variables, no stationery, no per-account signatures.
Plan to beat Outlook:
New model MailTemplate (name, subject_template, body_html_template, variables JSONB, category, is_shared)
Template variables pull live ERP data: {{crm.contact.name}}, {{finance.invoice.amount}}, {{project.status}}
Template picker in compose modal
Per-account signatures (add account_id FK to MailSignature)
Signature editor using TipTap (same rich text editor as compose)
Era edge: Template variables bind to live ERP data — Outlook templates are static text only
11. Delivery/Read Receipts, Voting Buttons, and Message Tracking
Status: PARTIAL
What exists: ReadReceipt model, request flag on send, confirm endpoint.
Gap: No delivery receipts (DSN), no voting/polls, no open tracking pixel, no link click tracking.
Plan to beat Outlook:
New model MailPoll (message_id, question, options, responses JSONB, closes_at)
Tracking pixel endpoint for open detection
DSN parsing from Stalwart delivery notifications
Poll creation UI in compose, results visualization (bar chart)
WhatsApp-style checkmarks: sent ✓ / delivered ✓✓ / read ✓✓(blue)
12. Data Loss Prevention (DLP), Encryption, Sensitivity Labels, and Security Warnings
Status: NO
What exists: Admin spam config only.
Plan to beat Outlook:
New model SensitivityLabel (name, color, encryption_required, auto_apply_rules)
New model DLPPolicy (patterns JSONB for SSN/credit card/etc., action: warn/block)
Pre-send DLP scanner service
External recipient warning banner in compose
Admin DLP policy management
Era edge: DLP cross-references Finance — if email contains invoice data, verify recipient is authorized on that customer's CRM account
13. Calendar Notifications Even When App Is Closed
Status: NO
Plan to beat Outlook:
Web Push API with VAPID keys (self-hosted, zero external dependency)
New model PushSubscription (endpoint, p256dh_key, auth_key)
pywebpush for server-side push delivery
Celery beat tasks: calendar reminders (5/15 min before), new mail notifications for high-priority
Service Worker handles push events → system notification
14. Customizable Ribbon, Themes, Fonts, and Interface Density Options
Status: PARTIAL (dark mode exists)
Plan to beat Outlook:
User preferences API: density (compact/normal/relaxed), reading pane position (right/bottom/off), font size, custom accent color, toolbar action ordering
Frontend: density toggle, reading pane position selector, drag-and-drop toolbar customization, theme picker
15. Voice Dictation, Inking, and Emoji/Sticker Support in Compose
Status: NO — CRITICAL GAP: compose is a plain <textarea>
Plan to beat Outlook:
Replace textarea with TipTap (ProseMirror-based, MIT, headless, works with Tailwind/Radix)
Extensions: bold, italic, underline, link, image, lists, blockquote, table, text color, @-mentions
Emoji picker via @emoji-mart/react
Voice dictation via Web Speech API (SpeechRecognition)
File attachment upload: drag-and-drop + file picker → MinIO → storage_key
Inline image paste from clipboard
New endpoint: POST /mail/attachments/upload → MinIO storage
16. Meeting Chat Integration, Teams/Loop Components, and Collaboration Tools
Status: NO (Jitsi exists for video but not integrated from mail)
Plan to beat Outlook:
"Meet Now" button in message detail → instant Jitsi room with email participants
"Share Document" in compose → Drive picker → ONLYOFFICE link card
Meeting link detection in email body → renders joinable meeting card
Era edge: Jitsi meetings work with any email recipient (no account required); ONLYOFFICE docs editable by anyone with link
17. Automatic Email Triage, Smart Replies, and Sentiment Analysis
Status: PARTIAL (AI reply suggestions exist)
Plan to beat Outlook:
AI triage: classify all unread → urgent/needs-reply/fyi/promotional/spam
Sentiment indicator on messages (positive/neutral/negative + emotions)
Enhanced smart replies with tone parameter (professional/casual/empathetic) and length control
Celery task auto_triage_new_mail on receipt
Era edge: "This customer sounds frustrated — they have 2 open support tickets. Priority: HIGH."
18. Mobile Sync with Full-Featured Native Apps
Status: PARTIAL (responsive design, swipe gestures)
Plan to beat Outlook:
PWA first: manifest.json, service worker, installable prompt
Touch optimization: 48px targets, pull-to-refresh
Later: Capacitor wrapper for App Store distribution
ActiveSync/JMAP endpoint for native mail client compatibility
19. Advanced Reporting, Analytics, and Performance Dashboards
Status: NO
Plan to beat Outlook:
Personal analytics: sent/received trends, avg response time, top contacts, busiest hours
Team analytics (App Admin): team response times, SLA metrics, unresolved email count
AI insights: "Your response time to VIP customers improved 20% this month"
Charts using Recharts: area chart (trends), bar (top contacts), heatmap (busy hours)
20. API Access, Add-Ins, and Third-Party Integrations
Status: PARTIAL (full REST API with JWT exists)
Gap: No webhook system, no add-in framework, no OAuth2 scopes for mail.
Plan to beat Outlook:
New model MailWebhook (url, events, secret, is_active)
Webhook delivery on mail events with HMAC signature
OAuth2 scopes for mail access by third-party apps
JMAP protocol support (long-term)
21. Sandbox/Testing Environment and Version Control for Rules/Templates
Status: NO
Plan to beat Outlook:
Rule test mode: "Test this rule" → select message, see what would happen without executing
Version history on rules and templates (version integer + versions JSONB array)
Revert endpoint: POST /mail/rules/{id}/revert/{version}
Template preview with sample data rendering
PART 2: MODERN AI-ERA ENHANCEMENTS
A. Email Management & Triage
AI Priority Scoring with Era Context — Every incoming email gets a priority_score (0-1) computed by Ollama, cross-referencing sender against CRM contacts, open deals, support tickets. An email from a customer with a $50K deal scores higher than an unknown sender.

Predictive Cross-Module Routing — When AI classifies an email as support-request, auto-create a Support ticket. When finance-invoice, extract amount/vendor and present one-click "Create AP Entry." When deal-related, auto-suggest CRM deal linking. All via mail.classified event handlers.

Smart Folders (AI-Generated Dynamic Views) — Unlike static labels, these are saved AI queries: "Emails about Project Alpha", "Unresolved Finance Items", "VIP Senders (deals > $10K)". AI suggests new smart folders based on patterns.

B. Calendar & Scheduling
AI Scheduling Assistant ("Find a Time") — "Schedule Meeting" button in compose queries CalendarEvent overlaps for attendees, Ollama generates natural-language time suggestions. Inserts ICS attachment.

Meeting Prep Briefing from Era Data — 15 min before a meeting, auto-generate briefing: recent emails with attendees, CRM deal status, project task updates, open support tickets. Pushed via Web Push notification.

Email-to-Calendar with AI Context Extraction — When email body contains scheduling language ("Let's meet Thursday at 3pm"), AI extracts datetime/participants/topic and shows one-click "Add to Calendar" banner.

C. Tasks & Contacts
AI Task Extraction from Threads — Scan entire thread, extract all action items as checklist: "Send revised proposal by Friday", "Update budget spreadsheet." Each item has one-click "Create Task" pre-filled with title, due date, assignee.

Contact Intelligence with Relationship Graph — For each contact: email frequency, avg response time, sentiment trend, Era cross-references (CRM contact? HR employee? Support requester?). Contact detail panel slides open from sender avatar.

AI Contact Deduplication — Detect john@company.com in mail = "John Smith" in CRM. Surface merge suggestions. Enrich: "3 open support tickets, $25K deal in pipeline, 2 overdue invoices."

D. AI Copilot & Automation
Context-Aware Drafting with Full Era Knowledge — AI queries Finance for invoice status, CRM for deal progress, Projects for task status before drafting. "Hi, your Invoice #1234 for $5,000 was approved March 1, payment scheduled March 15."

One-Click Email-to-Invoice / Email-to-PO — "Turn this email into an invoice" button. AI extracts vendor, line items, amounts, due date. Pre-fills Finance invoice form. Similarly for Purchase Orders.

Workflow Automation with AI Conditions — Extend MailRule with AI conditions: "If AI classifies as support-request AND sender has open deal > $10K, auto-forward to account manager AND create high-priority ticket."

E. Offline & Security
Compliance-Aware Archiving — Retention policies per label/category: "Finance emails → 7 years (SOX)", "Newsletter → auto-purge 30 days." AI categorization feeds directly into which policy applies.

DLP for Financial Data — Pre-send scan for SSN, credit card, bank account patterns. Era twist: if email contains invoice data, verify recipient is authorized on that CRM account.

Offline AI-Powered Mail — Cache 500 messages in IndexedDB. Offline compose queued for sync. Lightweight ONNX model in Service Worker for basic reply suggestions without Ollama connectivity.

F. Integrations & Collaboration
Shared Inboxes with Auto-Routing — support@company.com shared inbox: AI-triaged, auto-assigned to team members by expertise/workload. Auto-creates Support tickets. sales@ auto-creates CRM leads.

Email Annotations (Internal Team Comments) — Team members add internal notes to emails (invisible to sender). Sales team discusses how to respond before replying. New model MailAnnotation.

Real-Time Team Activity Feed — Live feed: "Alice replied to Acme inquiry", "Bob created support ticket from email #123." WebSocket-powered, subscribes to Redis EventBus mail events.

PART 3: PRIORITIZED 6-MONTH ROADMAP
Phase 1 — MVP (Weeks 1-8): Core Email + Calendar + Deep Era Integration + Basic AI
Week 1-2: Rich Text Editor & Compose Overhaul (CRITICAL)

Replace <textarea> in MailPage.tsx ComposeModal with TipTap editor
Bold, italic, underline, links, lists, blockquote, inline images, @-mentions
File attachment upload flow: upload to MinIO → storage_key → attach to send payload
New endpoint: POST /mail/attachments/upload
Files: frontend/src/features/mail/MailPage.tsx, backend/app/api/v1/mail.py
Week 3: Stalwart + IMAP Sync Engine

Add Stalwart to docker-compose.yml as urban-erp-stalwart
New model MailAccount for external account credentials
New service imap_sync.py: Celery beat task syncs every 5 min
Files: docker-compose.yml, backend/app/models/mail_storage.py, backend/app/services/imap_sync.py
Week 4: AI Classification & Priority Scoring

Add columns to MailboxMessage: priority_score, ai_category, ai_summary
Celery task on mail.received: classify via Ollama, cross-reference CRM/Support
Alembic migration
Files: backend/app/models/mail_storage.py, backend/app/tasks/
Week 5: Focused Inbox & Smart Folders

Frontend "Focus" / "Other" tabs based on priority_score
New model SmartFolder + CRUD API
AI-suggested smart folder creation
Files: frontend/src/features/mail/MailPage.tsx, backend/app/models/mail.py
Week 6: Calendar Integration from Mail

AI datetime extraction from email body
"Add to Calendar" banner in message detail
"Schedule Meeting" panel in compose with availability checking
ICS generation for invitations
Files: backend/app/services/mail_parser.py, frontend/src/features/mail/
Week 7: Enhanced Cross-Module Routing

Auto-create Support tickets from support-request emails
"Create Invoice" / "Create PO" extraction endpoints
mail.classified event handlers for routing
Files: backend/app/main.py (event handlers), backend/app/api/v1/mail_ext.py
Week 8: Real-Time Push & Polish

WebSocket endpoint for new mail notifications
Web Push via VAPID keys + pywebpush
Fix snooze: Celery beat task to unsnooze messages
PostgreSQL full-text search: add search_vector tsvector + GIN index
Files: backend/app/api/v1/mail.py, frontend/src/features/mail/
Phase 2 — Months 3-4: Full Copilot, Tasks/Contacts, Offline, Rules & Automation
Month 3 Weeks 1-2: Context-Aware AI Copilot

Extend ai-suggest-reply with Era tool calls (Finance/CRM/Projects lookups)
Thread summarization endpoint + UI banner
Full draft generation with Era context
Tone checker and smart compose
Month 3 Weeks 3-4: Task Extraction & Contact Intelligence

Thread-level action item extraction
MailContactProfile model with computed fields
Contact card popover on sender hover
Contact-CRM sync
Month 4 Weeks 1-2: Offline Engine

Service Worker + Workbox caching strategy
IndexedDB via Dexie.js (last 500 messages)
Offline compose with sync-on-reconnect
PWA manifest + installable prompt
Month 4 Weeks 3-4: Advanced Rules & Automation

Rule execution engine (finally processes incoming mail against rules)
Quick Steps model + UI
Email templates with ERP variable substitution
Scheduled send (Celery task sends at scheduled time)
AI-powered rule conditions
Phase 3 — Months 5-6: Analytics, Collaboration, Security & Enterprise
Month 5 Weeks 1-2: Analytics Dashboard

Personal: sent/received trends, response times, top contacts, busy hours heatmap
Team (App Admin): SLA metrics, team response times
AI insights: "Your VIP response time improved 20%"
Month 5 Weeks 3-4: Shared Inboxes & Collaboration

SharedMailbox model + shared inbox UI with claim/release
MailAnnotation model for internal team comments
Real-time activity feed via WebSocket
Month 6 Weeks 1-2: Security & Compliance

DLP scanner + DLPPolicy model
Sensitivity labels + SensitivityLabel model
Retention policies + nightly enforcement
External recipient warnings
Voting/polls: MailPoll model + UI
Month 6 Weeks 3-4: Polish & Enterprise Readiness

Interface density options (compact/normal/relaxed)
Reading pane position toggle (right/bottom/off)
Rule/template version history
MBOX import/export
Multi-account support (external IMAP via OAuth2)
Performance: cursor pagination, react-window virtualization
PART 4: TECHNICAL RECOMMENDATIONS
Component	Recommendation	Rationale
Rich Text Editor	TipTap v2 (ProseMirror)	MIT, headless, works with Tailwind/Radix, collaborative editing ready, excellent extension system
Real-Time Sync	WebSocket primary, SSE fallback	Already used for AI agent system; add mail-specific WS endpoint
Offline Engine	Workbox + Dexie.js (IndexedDB)	Cache-first for list, network-first for send; queue offline drafts
Push Notifications	Web Push API (VAPID)	Self-hosted, zero external dependency; pywebpush server-side
Mobile	PWA first, Capacitor later	Existing responsive design; PWA covers 90% of use cases; Capacitor for App Store in Phase 4+
AI Integration	3-tier: sync inline (<2s), async Celery (2-30s), agent-based (>30s)	Reply suggestions = sync; classification = async; complex workflows = Urban Bad AI agents
Search Engine	PostgreSQL FTS (GIN + tsvector)	Sufficient for <10M messages; add Meilisearch only if volume exceeds that
Calendar	Keep PostgreSQL-based CalendarEvent + python-dateutil RRULE	No separate CalDAV server needed; icalendar lib for ICS import/export
Email Parser	Extend existing mail_parser.py + icalendar lib	Already handles ICS; add structured extraction via Ollama for invoices/tasks
PART 5: FIVE BOLD "ERA MAIL-ONLY" DIFFERENTIATORS
1. The Financial Context Ribbon
When opening an email from a known vendor/customer, a ribbon appears at the top showing real-time financial context:

From vendor: "Acme Corp — 3 open POs ($45K) — 1 overdue invoice ($12K, 15 days late) — Last payment: Feb 28"
From customer: "BigCo Inc — Deal Stage: Negotiation ($200K) — 2 unpaid invoices ($8K) — Lifetime revenue: $1.2M" Queries fan out to Finance, CRM, HR, Support. Cached in Redis (5 min TTL). Outlook has zero access to AP/AR ledger or deal pipeline.
2. The Predictive Action Bar
At the top of each email, AI-predicted next actions computed from email content + Era data:

Customer asking about order: [Check Order #1234] [Reply with Tracking] [Escalate to Support]
Supplier confirming shipment: [Update GRN] [Notify Warehouse] [Update PO Status]
Employee requesting PTO: [Open Leave Request] [Check Team Calendar] [Approve/Deny] Each action is one-click, executes cross-module + auto-generates reply. Outlook's "quick actions" are generic Reply/Forward/Delete.
3. Supply Chain Email Automation (PO-to-Payment in Zero Clicks)
Supplier sends PDF invoice → AI extracts data → matches to existing PO → three-way match (PO vs GRN vs Invoice) → auto-creates AP entry → auto-schedules payment → auto-replies "Invoice approved, payment on April 15." If discrepancy: flags for human review with side-by-side comparison. Outlook has no PO system, no GRN tracking, no AP ledger.

4. Deal Room Email Mode
When viewing emails related to a CRM deal, "Deal Room" activates:

Left: all deal conversation emails (across all participants)
Center: current email + AI deal context sidebar
Right: deal timeline (stage changes, proposals from Drive, meeting history, financial commitments) One-click: update deal stage, log touchpoint, attach email as evidence, generate follow-up task, draft proposal from template with deal data. Salesforce requires manual linking and never shows this in the mail client itself.
5. Manufacturing Floor Email Bridge
Equipment failure alert emails → AI extracts machine ID + error code → auto-creates Work Order in Manufacturing → checks spare parts in Supply Chain → notifies technician → auto-replies "Work Order #WO-789 created, technician assigned, ETA 2 hours." Quality report emails → auto-update QC records → trigger quarantine if batch fails. No email client has manufacturing execution integration.

NEW DATABASE MODELS (12 total)
MailAccount — multi-account support
FocusedInboxScore — AI sender scoring
MailQuickStep — one-click action sequences
MailCategory — cross-folder colored categories
MailTemplate — reusable templates with ERP variables
MailPoll — voting buttons
MailContactProfile — rich contact intelligence
SensitivityLabel — DLP labels
DLPPolicy — data loss prevention rules
PushSubscription — web push subscriptions
MailWebhook — external webhook subscriptions
SearchFolder — virtual saved search folders
SharedMailbox — shared team inboxes
MailAnnotation — internal team comments on emails
MailRetentionPolicy — compliance archiving rules
SmartFolder — AI-generated dynamic views
COLUMN ADDITIONS TO MailboxMessage
account_id (UUID FK nullable), is_pinned (bool), flag_status (varchar), flag_due_date (datetime), flag_reminder_at (datetime), category_ids (JSONB), sensitivity_label_id (UUID FK nullable), search_vector (tsvector + GIN index), display_format (JSONB), scheduled_send_at (datetime nullable), ai_triage (JSONB nullable), priority_score (float nullable), ai_category (varchar nullable), ai_summary (text nullable), predicted_actions (JSONB nullable)
CRITICAL FILES TO MODIFY
backend/app/models/mail_storage.py — MailboxMessage (15+ new columns)
backend/app/models/mail.py — Add new models or create mail_advanced.py
backend/app/api/v1/mail.py — Primary router (new endpoints for attachments, AI, scheduling)
backend/app/api/v1/mail_ext.py — Cross-module extensions
frontend/src/features/mail/MailPage.tsx — Main UI overhaul (TipTap, action bar, focused inbox)
frontend/src/api/mail.ts — New API hooks for all new endpoints
docker-compose.yml — Add Stalwart container
backend/app/main.py — New event handlers (mail.received, mail.classified)
backend/app/services/ai_tools.py — New mail-specific AI tools
backend/app/tasks/celery_app.py — New Celery tasks (sync, triage, snooze, reminders)
VERIFICATION
Rich text compose: send formatted email, verify HTML renders in recipient client
IMAP sync: connect external Gmail/Outlook account, verify messages appear
AI triage: send test emails, verify classification and priority scoring
Cross-module: verify auto-ticket creation from support-classified email
Calendar: extract meeting time from email, verify CalendarEvent created
Offline: enable airplane mode, verify cached messages readable and drafts queued
Push: close browser tab, verify notification received for new high-priority email
Full-text search: search with operators, verify ranked results
Run existing tests: pytest backend/tests/test_mail_extended.py