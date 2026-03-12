# Era Mail Upgrade — Beat Microsoft Outlook Desktop 2026

> **Goal:** Transform Era Mail from a basic email client into the world's best internal email experience — where email disappears into action inside Era.

---

## PART 1: GAP ANALYSIS (21 Feature Areas vs Outlook Desktop 2026)

### 1. Multi-Account Support with Focused Inbox and Unified Views
- **Status:** NO
- **What exists:** Single-account only. `MailboxMessage.user_id` ties messages to one user.
- **Gap:** No external account connections (Gmail, Outlook, Yahoo via IMAP/OAuth2), no Focused Inbox classification, no unified view.
- **How we beat Outlook:**
  - New model `MailAccount` (provider, oauth_tokens encrypted, imap/smtp config, sync_enabled)
  - Add `account_id` FK to `MailboxMessage`
  - Celery task `sync_external_account` using `aioimaplib` for IMAP IDLE + periodic fetch
  - New model `FocusedInboxScore` — AI + CRM-aware sender scoring
  - **Era edge:** Focused Inbox uses CRM deal data + support ticket status. Senders with open deals/tickets score higher. Outlook has no CRM integration.

### 2. Advanced Email Rules, Quick Steps, Automation, and Conditional Formatting
- **Status:** PARTIAL
- **What exists:** `MailRule` model (conditions/actions JSONB, priority, stop_processing). `MailFilter` (Sieve-compatible). CRUD endpoints. But **rules are never executed** — no rule engine processes incoming messages.
- **Gap:** No rule execution engine, no Quick Steps, no conditional formatting, no "run rule now."
- **How we beat Outlook:**
  - New service `mail_rule_engine.py` — evaluates rules on incoming messages, executes actions
  - New model `MailQuickStep` (name, icon, keyboard_shortcut, actions JSONB array)
  - Conditional formatting: add `display_format` JSONB to `MailboxMessage`
  - **Era edge:** Rule actions can trigger cross-module operations (e.g., "If email from supplier X, auto-create procurement request in Supply Chain")

### 3. Categories, Flags, Pinning, Snoozing, and Smart Inbox Triage
- **Status:** PARTIAL
- **What exists:** Labels (color+name), snooze (stores time in headers JSONB, marks read), star toggle.
- **Gap:** No categories, no flag with due date/reminder, no pinning, **snooze has no Celery task to unsnooze**, no smart triage.
- **How we beat Outlook:**
  - Add to `MailboxMessage`: `is_pinned`, `flag_status`, `flag_due_date`, `flag_reminder_at`, `category_ids`
  - New model `MailCategory` (name, color, keyboard_shortcut)
  - Celery beat tasks: `check_snoozed_messages`, `check_flag_reminders`
  - AI triage: classify inbox into urgent/needs-reply/fyi/promotional/spam
  - **Era edge:** Triage cross-references CRM deals and support tickets for priority

### 4. Powerful Search, Search Folders, and Instant Filters
- **Status:** PARTIAL
- **What exists:** ILIKE search on subject/from/body_text. Filters: from, has_attachment, date range.
- **Gap:** No full-text search index, no Search Folders, no instant filter bar, no natural language search.
- **How we beat Outlook:**
  - Add `search_vector` tsvector column to `MailboxMessage` with GIN index
  - Rewrite search to use `ts_query` with ranking and operators: `from:`, `to:`, `has:attachment`, `is:unread`, `label:`, `before:`, `after:`
  - New model `SearchFolder` (name, saved query string, icon)
  - AI search: natural language → structured query via Ollama
  - **Era edge:** AI search understands ERP context — "emails about deal X" cross-references CRM deal names

### 5. Fully Integrated Calendar with Scheduling Assistant, Availability View, and Meeting Insights
- **Status:** PARTIAL
- **What exists:** ICS parser in `mail_parser.py`, `mail.sent` event triggers calendar integration. No inline calendar, no scheduling assistant, no availability view.
- **How we beat Outlook:**
  - Calendar mini-widget in mail right sidebar
  - "Schedule Meeting" button in compose → availability grid
  - ICS detection banner: "Accept | Tentative | Decline"
  - AI meeting insights: pre-meeting summary pulling CRM/projects/support data
  - **Era edge:** Meeting prep shows CRM deal stage, support ticket status, project milestones with attendees

### 6. Tasks and To-Do Integration with Due Dates, Reminders, and Prioritization
- **Status:** PARTIAL
- **What exists:** "Convert to Task" creates a Projects task from email. No inline task view, no flag-to-task.
- **How we beat Outlook:**
  - Tasks pane (right sidebar) aggregating flagged emails + project tasks
  - Flag with due date auto-creates task in Projects module
  - AI action item extraction from threads
  - **Era edge:** Tasks auto-link to Projects sprints, CRM deals, and Finance budgets

### 7. Contacts / People Hub with Rich Profiles and Relationship Tracking
- **Status:** PARTIAL
- **What exists:** `GET /mail/contacts` extracts contacts from sent history. `ContactPicker.tsx` for autocomplete.
- **How we beat Outlook:**
  - New model `MailContactProfile` (email, display_name, avatar, title, company, crm_contact_id FK, stats)
  - Contact card popover on sender hover: CRM deal status, support tickets, invoices
  - People Hub page: all contacts searchable, sorted by frequency
  - **Era edge:** Contact card shows deal pipeline, outstanding invoices, open support tickets

### 8. AI Copilot for Drafting Replies, Summarization, Triage Actions, and Email Insights
- **Status:** PARTIAL
- **What exists:** `POST /mail/ai-suggest-reply` generates 3 reply suggestions via Ollama.
- **How we beat Outlook:**
  - Thread summarization + collapsible summary banner
  - Full draft generation with Era context (AI queries Finance/CRM/Projects before drafting)
  - Tone checker (professional/casual/aggressive)
  - Smart compose: gray ghost text autocomplete
  - Email insights dashboard
  - **Era edge:** AI drafts reference actual ERP data — "Invoice #1234 for $5,000 was approved March 1"

### 9. Offline Access, Cached Mode, and PST/Local File Support
- **Status:** NO
- **How we beat Outlook:**
  - Service Worker + Workbox + IndexedDB via Dexie.js (500 cached messages)
  - Offline compose: queue drafts, send on reconnect
  - Delta sync endpoint
  - Import/Export: MBOX format
  - **Era edge:** Offline includes cached ERP context for offline AI suggestions

### 10. Custom Signatures, Email Templates, and Stationery
- **Status:** PARTIAL
- **What exists:** `MailSignature` model with text+HTML, CRUD endpoints.
- **How we beat Outlook:**
  - New model `MailTemplate` with ERP merge variables: `{{crm.contact.name}}`, `{{finance.invoice.amount}}`
  - Per-account signatures
  - Signature editor using TipTap
  - **Era edge:** Template variables bind to live ERP data — Outlook templates are static

### 11. Delivery/Read Receipts, Voting Buttons, and Message Tracking
- **Status:** PARTIAL
- **What exists:** `ReadReceipt` model, request flag on send.
- **How we beat Outlook:**
  - New model `MailPoll` (voting buttons with question + options)
  - Tracking pixel endpoint for open detection
  - WhatsApp-style checkmarks: sent ✓ / delivered ✓✓ / read ✓✓(blue)

### 12. Data Loss Prevention (DLP), Encryption, Sensitivity Labels, and Security Warnings
- **Status:** NO
- **How we beat Outlook:**
  - New models `SensitivityLabel` and `DLPPolicy`
  - Pre-send DLP scanner
  - External recipient warning banner
  - **Era edge:** DLP cross-references Finance — if email contains invoice data, verify recipient is authorized on that CRM account

### 13. Calendar Notifications Even When App Is Closed
- **Status:** NO
- **How we beat Outlook:**
  - Web Push API with VAPID keys (self-hosted, zero external dependency)
  - `pywebpush` for server-side push delivery
  - Celery beat tasks for calendar reminders and high-priority mail notifications

### 14. Customizable Ribbon, Themes, Fonts, and Interface Density Options
- **Status:** PARTIAL (dark mode exists)
- **How we beat Outlook:**
  - Density toggle (compact/normal/relaxed)
  - Reading pane position (right/bottom/off)
  - Customizable toolbar with drag-and-drop
  - Theme picker with custom accent color

### 15. Voice Dictation, Inking, and Emoji/Sticker Support in Compose
- **Status:** ~~NO~~ → **DONE (Phase 1)**
- **Implemented:**
  - ✅ TipTap rich text editor (bold, italic, underline, strikethrough, lists, blockquote, code, links, images, text color, highlight, text align)
  - ✅ Emoji picker with quick-access grid
  - ✅ File attachment upload with drag-and-drop + paste support
  - ✅ Inline image paste from clipboard
  - Voice dictation via Web Speech API (Phase 2)

### 16. Meeting Chat Integration, Teams/Loop Components, and Collaboration Tools
- **Status:** NO (Jitsi exists for video but not integrated from mail)
- **How we beat Outlook:**
  - "Meet Now" button → instant Jitsi room with email participants
  - "Share Document" in compose → Drive picker → ONLYOFFICE link card
  - **Era edge:** Jitsi meetings work with any email recipient (no account required)

### 17. Automatic Email Triage, Smart Replies, and Sentiment Analysis
- **Status:** PARTIAL (AI reply suggestions exist)
- **How we beat Outlook:**
  - AI triage: classify unread → urgent/needs-reply/fyi/promotional/spam
  - Sentiment indicator on messages
  - Enhanced smart replies with tone and length control
  - **Era edge:** "This customer sounds frustrated — they have 2 open support tickets. Priority: HIGH."

### 18. Mobile Sync with Full-Featured Native Apps
- **Status:** PARTIAL (responsive design, swipe gestures)
- **How we beat Outlook:**
  - PWA first: manifest.json, service worker, installable prompt
  - Later: Capacitor wrapper for App Store distribution

### 19. Advanced Reporting, Analytics, and Performance Dashboards
- **Status:** NO
- **How we beat Outlook:**
  - Personal analytics: sent/received trends, avg response time, top contacts, busy hours heatmap
  - Team analytics (App Admin): SLA metrics, team response times
  - AI insights: "Your VIP response time improved 20%"

### 20. API Access, Add-Ins, and Third-Party Integrations
- **Status:** PARTIAL (full REST API with JWT exists)
- **How we beat Outlook:**
  - New model `MailWebhook` with HMAC-signed delivery
  - OAuth2 scopes for mail access
  - JMAP protocol support (long-term)

### 21. Sandbox/Testing Environment and Version Control for Rules/Templates
- **Status:** NO
- **How we beat Outlook:**
  - Rule test mode: select message, see what would happen without executing
  - Version history on rules and templates
  - Template preview with sample data

---

## PART 2: MODERN AI-ERA ENHANCEMENTS (2026 Features)

### A. Email Management & Triage
1. **AI Priority Scoring with Era Context** — Every email gets a `priority_score` (0-1) cross-referencing sender against CRM contacts, open deals, support tickets
2. **Predictive Cross-Module Routing** — `support-request` emails auto-create tickets; `finance-invoice` emails present one-click "Create AP Entry"; `deal-related` auto-suggest CRM linking
3. **Smart Folders (AI-Generated Dynamic Views)** — Saved AI queries like "Emails about Project Alpha", "Unresolved Finance Items", "VIP Senders (deals > $10K)"

### B. Calendar & Scheduling
1. **AI Scheduling Assistant ("Find a Time")** — Queries CalendarEvent overlaps, generates natural-language time suggestions
2. **Meeting Prep Briefing from Era Data** — 15 min before: recent emails with attendees, CRM deal status, project updates, support tickets
3. **Email-to-Calendar with AI Extraction** — Detect scheduling language → one-click "Add to Calendar" banner

### C. Tasks & Contacts
1. **AI Task Extraction from Threads** — Scan thread, extract action items as checklist with one-click "Create Task"
2. **Contact Intelligence with Relationship Graph** — Email frequency, response time, sentiment trend, CRM/HR/Support cross-references
3. **AI Contact Deduplication** — Detect mail-CRM mismatches, surface merge suggestions

### D. AI Copilot & Automation
1. **Context-Aware Drafting with Full Era Knowledge** — AI queries Finance/CRM/Projects before drafting replies
2. **One-Click Email-to-Invoice / Email-to-PO** — AI extracts vendor, line items, amounts. Pre-fills Finance forms
3. **Workflow Automation with AI Conditions** — Extend MailRule with AI-powered conditions

### E. Offline & Security
1. **Compliance-Aware Archiving** — Retention policies per category: "Finance emails → 7 years (SOX)"
2. **DLP for Financial Data** — Pre-send scan + verify recipient authorization via CRM
3. **Offline AI-Powered Mail** — Cache messages in IndexedDB, lightweight ONNX model for basic suggestions

### F. Integrations & Collaboration
1. **Shared Inboxes with Auto-Routing** — `support@` auto-creates tickets, `sales@` auto-creates leads
2. **Email Annotations (Internal Team Comments)** — Team discusses email before replying
3. **Real-Time Team Activity Feed** — WebSocket-powered: "Alice replied to Acme inquiry"

---

## PART 3: PRIORITIZED 6-MONTH ROADMAP

### Phase 1 — MVP (Weeks 1-8)

| Week | Deliverable | Key Files |
|------|-------------|-----------|
| **1-2** ✅ | TipTap rich text editor, file attachment upload, reply/forward compose | `MailPage.tsx`, `RichTextEditor.tsx`, `mail.py` |
| **3** | Stalwart in Docker, IMAP sync engine, `MailAccount` model | `docker-compose.yml`, `imap_sync.py` |
| **4** | AI classification + priority scoring (`priority_score`, `ai_category`) | `mail_storage.py`, Celery tasks |
| **5** | Focused Inbox + Smart Folders UI | `MailPage.tsx`, `SmartFolder` model |
| **6** | Calendar integration: ICS banner, "Schedule Meeting", availability grid | `mail_parser.py`, frontend |
| **7** | Cross-module routing: auto-tickets, auto-invoices, auto-PO | `main.py` event handlers |
| **8** | WebSocket push, Web Push notifications, fix snooze, FTS with GIN index | `mail.py`, service worker |

### Phase 2 — Months 3-4

| Period | Deliverable |
|--------|-------------|
| Month 3 Wk 1-2 | Context-aware AI copilot: thread summarization, full draft with Era data, tone checker |
| Month 3 Wk 3-4 | Task extraction from threads, `MailContactProfile`, contact card popover, CRM sync |
| Month 4 Wk 1-2 | Offline engine: Service Worker + IndexedDB + PWA manifest |
| Month 4 Wk 3-4 | Rule execution engine, Quick Steps, email templates with ERP variables, scheduled send |

### Phase 3 — Months 5-6

| Period | Deliverable |
|--------|-------------|
| Month 5 Wk 1-2 | Email analytics dashboard (personal + team) |
| Month 5 Wk 3-4 | Shared inboxes, email annotations, real-time activity feed |
| Month 6 Wk 1-2 | DLP scanner, sensitivity labels, retention policies, voting/polls |
| Month 6 Wk 3-4 | Density options, version history for rules/templates, MBOX import/export, multi-account OAuth2 |

---

## PART 4: TECHNICAL RECOMMENDATIONS

| Component | Choice | Why |
|-----------|--------|-----|
| Rich Text Editor | **TipTap v2** (ProseMirror) | MIT, headless, Tailwind/Radix compatible, collaborative editing ready |
| Real-Time Sync | **WebSocket** primary, SSE fallback | Already used for AI agent system |
| Offline Engine | **Workbox + Dexie.js** | Cache-first for list, network-first for send |
| Push Notifications | **Web Push API (VAPID)** | Self-hosted, zero external dependency |
| Mobile | **PWA first**, Capacitor later | Existing responsive design covers 90% |
| AI Integration | **3-tier**: sync (<2s), async Celery (2-30s), agent (>30s) | Match latency to task complexity |
| Search Engine | **PostgreSQL FTS (GIN + tsvector)** | Sufficient for <10M messages |
| Calendar | **PostgreSQL CalendarEvent + python-dateutil RRULE** | No separate CalDAV needed |

---

## PART 5: FIVE BOLD "ERA MAIL-ONLY" DIFFERENTIATORS

### 1. The Financial Context Ribbon
When opening an email from a known vendor/customer, a ribbon shows real-time financial context:
- **From vendor:** "Acme Corp — 3 open POs ($45K) — 1 overdue invoice ($12K, 15 days late)"
- **From customer:** "BigCo Inc — Deal Stage: Negotiation ($200K) — 2 unpaid invoices ($8K)"
- **Outlook cannot do this** — zero access to AP/AR ledger or deal pipeline

### 2. The Predictive Action Bar
AI-predicted next actions computed from email content + Era data:
- Customer asking about order: **[Check Order #1234] [Reply with Tracking] [Escalate to Support]**
- Supplier confirming shipment: **[Update GRN] [Notify Warehouse] [Update PO Status]**
- **Outlook's quick actions** are generic Reply/Forward/Delete

### 3. Supply Chain Email Automation (PO-to-Payment in Zero Clicks)
Supplier PDF invoice → AI extracts data → matches PO → three-way match → auto-creates AP entry → auto-schedules payment → auto-replies confirmation
- **Outlook has no PO system**, no GRN tracking, no AP ledger

### 4. Deal Room Email Mode
CRM deal-linked emails get a dedicated view: all deal emails + AI context sidebar + deal timeline (stage changes, proposals, meetings, financials)
- **Salesforce requires manual linking** and never shows this in the mail client

### 5. Manufacturing Floor Email Bridge
Equipment alerts → auto-create Work Orders → check spare parts → notify technicians. Quality reports → auto-update QC records → trigger quarantine if batch fails
- **No email client** has manufacturing execution integration

---

## NEW DATABASE MODELS (16 total)

1. `MailAccount` — multi-account support
2. `FocusedInboxScore` — AI sender scoring
3. `MailQuickStep` — one-click action sequences
4. `MailCategory` — cross-folder colored categories
5. `MailTemplate` — reusable templates with ERP variables
6. `MailPoll` — voting buttons
7. `MailContactProfile` — rich contact intelligence
8. `SensitivityLabel` — DLP labels
9. `DLPPolicy` — data loss prevention rules
10. `PushSubscription` — web push subscriptions
11. `MailWebhook` — external webhook subscriptions
12. `SearchFolder` — virtual saved search folders
13. `SharedMailbox` — shared team inboxes
14. `MailAnnotation` — internal team comments
15. `MailRetentionPolicy` — compliance archiving rules
16. `SmartFolder` — AI-generated dynamic views

## COLUMN ADDITIONS TO `MailboxMessage`

```
account_id          UUID FK nullable
is_pinned           bool
flag_status         varchar (none/flagged/complete)
flag_due_date       datetime nullable
flag_reminder_at    datetime nullable
category_ids        JSONB array
sensitivity_label_id UUID FK nullable
search_vector       tsvector + GIN index
display_format      JSONB
scheduled_send_at   datetime nullable
ai_triage           JSONB nullable
priority_score      float nullable
ai_category         varchar nullable
ai_summary          text nullable
predicted_actions   JSONB nullable
```

---

## IMPLEMENTATION STATUS

### ✅ Completed (Phase 1, Week 1-2)
- [x] TipTap rich text editor replacing plain textarea
- [x] Toolbar: bold, italic, underline, strikethrough, lists, blockquote, code, text align, text color, highlight, links, images, emoji
- [x] File attachment upload to MinIO (`POST /mail/attachments/upload`)
- [x] Drag-and-drop + clipboard paste for images/files
- [x] Attachment chips with upload progress and remove
- [x] Reply/Forward now opens rich compose modal (instead of `prompt()`)
- [x] Reply All button added to message detail toolbar
- [x] HTML email body properly sent via `html_body` field

### Files Changed
- `frontend/src/features/mail/RichTextEditor.tsx` — NEW (rich text editor + attachment chips)
- `frontend/src/features/mail/MailPage.tsx` — Updated (ComposeModal overhaul, reply/forward, imports)
- `frontend/src/api/mail.ts` — Updated (attachment upload hook, SendMessagePayload.attachments)
- `backend/app/api/v1/mail.py` — Updated (attachment upload endpoint)
- `frontend/package.json` — Updated (TipTap + emoji-mart dependencies)
