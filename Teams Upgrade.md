Ready for review
Select text to add comments on the plan
Y&U Teams — Complete Upgrade Plan
From Meetings-Only Module to Full Collaboration Platform That Beats Microsoft Teams
Context
Y&U Teams currently exists as a meetings-only module (frontend/src/features/teams/ — 13 files focused on Jitsi video). It has strong foundations: Jitsi integration (4 Docker containers), meeting recordings/templates/notes, cross-module links to Projects/CRM/Notes, and a powerful AI agent system (Urban Bad AI with 100+ tools). However, it completely lacks persistent chat, channels, presence, calling, and all the collaboration features that define Microsoft Teams. This plan transforms Y&U Teams into a full-featured, AI-native collaboration platform that leverages the massive advantage of 250+ ERP models, 400+ endpoints, and 40+ event bus channels — something Microsoft Teams can never match.

SECTION 1: GAP ANALYSIS
#	Microsoft Teams 2026 Feature	Y&U Status	What Exists	What's Missing
1	Teams, Channels, Private/Shared Channels	Partial	Team + TeamMember models in user.py (name, description, app_scope)	No Channel model, no channel types (public/private/shared/announcement), no channel-level permissions, no channel discovery
2	Persistent Chat (1:1, Group, Channel) with Threading, Reactions, @Mentions, Rich Formatting	No	CRMComment has threading + mentions pattern; Conversation/ConversationMessage exist but for external CRM only; MeetingChat stores as JSON blob	No internal chat system at all — this is the single largest gap
3	Video & Audio Meetings with Screen Sharing, Whiteboarding, Recording, Live Transcription, AI Summaries	Strong	Full Jitsi (4 containers), MeetingRecording, MeetingChat, MeetingNote, MeetingTemplate, MeetingLink. Frontend: TeamsPage, MeetingLobby, InMeetingControls, PostMeetingSummary, VirtualBackgrounds, RecordingsPage	No whiteboarding, no live transcription (no STT engine), PostMeetingSummary has no AI content, no breakout room management
4	AI Copilot in Meetings & Chat	Strong (sidebar only)	Urban Bad AI: 4-agent orchestrator, 100+ tools, WebSocket streaming, AISidebar.tsx, approval tiers	AI lives in separate sidebar only — not embedded in chat flow, no inline suggestions, no smart replies, no auto-generated meeting recaps
5	Files Sharing, Co-Editing, Tabs	Strong	Drive module (DriveFile, DriveFolder, FileComment, TrashBin), MinIO storage, ONLYOFFICE editing, FileShare model	No per-channel file tab, no inline file preview in chat, no co-editing awareness in chat
6	Apps, Bots, Connectors, Tabs, Workflows	Partial	27 cross-module integrations, event bus with 40+ channels, AI tools with approval tiers	No bot users, no slash commands, no custom tab framework, no connectors, no chat-triggered workflows
7	Voice & Video Calling, PSTN, Auto-Attendant	No	Jitsi for scheduled meetings only	No 1:1 calling UI, no PSTN, no auto-attendant, no quick call from chat
8	Presence, Status, DND, Activity Feed	No	ActivityFeedEntry model exists but for dashboard only; Notification model exists	No real-time presence, no status messages, no DND, no Teams-specific activity feed
9	Live Events, Webinars, Town Halls with Q&A and Polls	No	Jitsi for meetings; Forms module for polls/surveys	No large-audience broadcast mode, no registration, no moderated Q&A
10	Tasks & Planner Integration	Very Strong	Full Projects module: tasks, subtasks, sprints, Kanban, custom fields, automation rules, recurring tasks, 10+ API routers	No inline task creation from chat, no task cards in channels
11	Deep ERP Integration	Best in Class	250+ models, 400+ endpoints, 27 cross-module integrations, 100+ AI tools across Finance/HR/CRM/Inventory/Manufacturing/SC/POS/E-Commerce/Support	ERP data not surfaced in chat context — no invoice cards, no PO approval from chat, no ERP notifications in channels
12	Custom Tabs, Dashboards, Automations	Partial	Analytics module with direct Postgres queries, Dashboard API	No configurable channel tabs, no per-team dashboards, no chat-triggered automations
13	Compliance, DLP, eDiscovery, Retention, Audit	Partial	CRM audit (crm_audit.py), HR audit (hr_audit.py)	No chat-specific retention policies, no DLP scanning, no eDiscovery, no message audit logs
14	Mobile Apps with Full Feature Parity	No	Responsive CSS with mobile breakpoints	No native app, no push notifications, no offline support
15	AI-Driven Search, Smart Replies, Sentiment	Partial	Search API exists, pgvector installed, Ollama available	No semantic search over chat, no smart replies, no sentiment analysis
16	Noise Suppression, Background Effects, Meeting Insights	Partial	VirtualBackgrounds.tsx exists, Jitsi has basic noise suppression	No meeting engagement analytics, no talk-time tracking
17	Offline Access and Cached Mode	No	Nothing	No service worker, no IndexedDB, no offline queue
18	Analytics & Reporting	Strong	Own analytics module (replaced Superset), direct Postgres queries	No Teams-specific analytics (messages/day, active users, engagement)
19	API Access, Webhooks, Extensibility	Strong	400+ REST endpoints, event bus	No outgoing/incoming webhooks for channels, no public API docs
20	Sandbox & Version Control	Partial	Docker Compose, Alembic migrations, Backups API	No sandbox mode for testing configurations
How to Beat Microsoft Teams in Each Area:
Feature 1 — Channels: Create Channel model with types (public/private/shared/direct/group/announcement). Leverage existing RBAC (Role, Permission in user.py) for channel-level permissions. Add auto-channel creation from ERP events (deal created → channel auto-spawns).

Feature 2 — Chat: Build new messaging subsystem: ChatMessage model with threading (parent_id), reactions (JSON), mentions (JSON), editing, deletion. WebSocket real-time delivery using existing useWebSocket.ts pattern. Redis pub/sub fan-out using existing EventBus.

Feature 3 — Meetings: Add faster-whisper Docker sidecar for live transcription. Wire PostMeetingSummary.tsx to AIService for AI summaries from transcripts. Integrate tldraw (MIT) for whiteboarding.

Feature 4 — AI Copilot: Embed AI as a first-class bot user in channels. Support /ask, /summarize, /action-items slash commands. Wire meeting.ended event to auto-generate summaries. Smart reply suggestions via Ollama.

Feature 5 — Files: Add ChannelTab model linking channels to Drive folders. Auto-create DriveFile entries on chat file shares. Inline file preview cards.

Feature 6 — Apps/Bots: Create BotUser concept, SlashCommand registry, ChatWorkflow model triggering Celery tasks from chat patterns.

Feature 7 — Calling: Build 1:1 calling using Jitsi ephemeral rooms. PSTN via SIP gateway later (Phase 3+).

Feature 8 — Presence: Redis-backed presence (presence:{user_id} with TTL 60s). WebSocket heartbeat every 30s. Status message support.

Feature 9 — Live Events: Phase 3. LiveEvent model with registration, Q&A (reuse CRMComment threading), Polls (reuse Forms module), Jitsi large-meeting mode.

Feature 10 — Tasks: /task slash command in chat. Tasks tab for channels. Task status changes post to linked channels via event bus.

Feature 11 — ERP Integration: Adaptive cards rendering ERP entities inline (invoice cards, PO approval cards, leave request cards). ERP events auto-post to relevant channels.

Feature 12 — Tabs/Dashboards: ChannelTab framework (files/tasks/notes/wiki/dashboard/form/custom_url). Pin any module page as a tab.

Feature 13 — Compliance: MessageRetentionPolicy model. eDiscovery search via Postgres tsvector. DLP regex + AI classification. ChatAuditLog for all message CRUD.

Feature 14 — Mobile: PWA with service worker + web push (Phase 3). React Native or Capacitor later.

Feature 15 — Search: Embed chat messages via Ollama → pgvector. Smart reply suggestions. Sentiment tagging.

Feature 16 — Meeting Insights: Post-meeting analytics (talk time per participant, engagement score) via AI summarizer.

Feature 17 — Offline: PWA + IndexedDB (Dexie.js) for message caching + offline queue (Phase 3).

Feature 18 — Analytics: Teams analytics endpoint: messages/day, active users, top channels, response times, meeting frequency.

Feature 19 — Webhooks: Webhook model (url, secret, events[], channel_id). Incoming webhook URLs for channels. Outgoing on event bus publish.

Feature 20 — Sandbox: sandbox flag on SystemSettings for testing channel configs before deploy (Phase 3).

SECTION 2: MODERN AI-ERA ENHANCEMENTS (2026 Next-Gen Features)
A. Teams & Channels
Zero-Config Auto-Channels — When a CRM deal, project, or support ticket is created, Y&U auto-creates a contextual channel with the right people, files, and tabs. Channel auto-archives when the entity closes.
AI Channel Digest — Daily/weekly AI-generated "What did I miss?" summaries per channel, pushed to users. Powered by Ollama via AIService.
Predictive @Mentions — AI suggests the most relevant people to @mention based on HR Skills module expertise graph + message history.
B. Chat & Messaging
Conversational ERP Actions — Type "create an invoice for Acme Corp, $5000, net-30" in chat → AI creates it using the existing create_invoice tool with approval workflow. Every ERP action becomes a chat command.
Smart Thread Resolution — AI detects when a thread question is answered and auto-marks it resolved using sentiment + intent classification.
AI Decision Memory — AI detects decisions in threads ("let's go with Option B"), logs them as formal Decision records with context, participants, and linked ERP entities. Semantically searchable months later.
C. Meetings & Calling
Auto Action Items — AI extracts action items from meeting transcripts and auto-creates Project tasks assigned to the mentioned person, posted to the linked channel.
Meeting Replay with Chapters — AI segments recordings into topic-based chapters ("Budget Discussion", "Q3 Planning"). Users jump to specific sections.
AI Meeting Scheduler — "Find a time for the finance team" → AI queries Calendar module, suggests optimal slots, creates the event.
D. AI Copilot & Automation
Chat-Triggered Workflows — /approve PO-2024-001 triggers supply chain approval. /escalate TICKET-500 escalates in support. /invoice Acme 5000 creates invoice. All routed through existing ToolExecutor.
Smart Notifications — AI learns which notifications each user acts on, suppresses low-priority ones, batches into daily digests.
Channel-to-Report Pipeline — Pin a thread as "report seed" → AI generates formatted report from discussion, exportable as PDF.
E. Files & Apps
Context-Aware File Suggestions — When discussing a topic in chat, AI suggests relevant Drive files, Docs, and Handbook articles based on semantic similarity.
Collaborative Whiteboarding — tldraw-based whiteboards shareable in channels and meetings, with AI that can diagram concepts discussed in chat.
F. ERP Integrations
Cross-Module Action Threads — A thread becomes an execution context: create support ticket + credit memo + quality hold + follow-up meeting, all without leaving the thread. Each action logged as an interactive card with audit trail.
Proactive Disruption Alerts — AI monitors live ERP data (cash flow, inventory levels, SLA breaches) and pushes alerts to relevant channels with one-click resolution actions.
Voice-to-Action — In a meeting, say "Remind me to follow up with the client about invoice 1234 next Tuesday" → AI creates a calendar event linked to the invoice.
G. Analytics & Compliance
AI-Powered DLP — Messages with sensitive data (credit cards, SSNs, financial projections) auto-flagged and optionally redacted using regex + AI classification.
Conversation Compliance Scoring — Each channel gets a compliance score based on retention adherence, DLP violations, and audit completeness.
Sentiment Dashboard — Real-time team morale tracking via message sentiment analysis, surfaced in HR People Analytics.
SECTION 3: PRIORITIZED 6-MONTH ROADMAP
Phase 1: MVP — Core Chat + Channels + Meetings + AI (Weeks 1-8)
Sprint 1-2 (Weeks 1-4): Chat Core Infrastructure
New Backend Models (backend/app/models/chat.py — new file):

Channel — id, team_id FK→Team, name, slug, channel_type ENUM(public|private|direct|group|announcement), topic, description, is_archived, created_by FK→User
ChannelMember — id, channel_id FK, user_id FK, role ENUM(owner|admin|member), notifications_pref ENUM(all|mentions|none), last_read_at, joined_at
ChatMessage — id, channel_id FK, sender_id FK→User, content TEXT, content_type ENUM(text|system|file|card|action), parent_id FK→self (threading), reactions JSONB, mentions JSONB, attachments JSONB, is_edited, is_deleted, edited_at, embedding VECTOR(384) for semantic search, search_vector TSVECTOR for full-text
MessageReadReceipt — id, message_id FK, user_id FK, read_at
UserPresence — Redis-only (no DB model). Key: presence:{user_id}, TTL 60s
New Backend API (backend/app/api/v1/chat.py — new file):

POST /chat/channels — create channel
GET /chat/channels — list user's channels (with unread counts)
GET /chat/channels/{id} — get channel details
PUT /chat/channels/{id} — update channel
POST /chat/channels/{id}/archive — archive channel
POST /chat/channels/{id}/members — add member
DELETE /chat/channels/{id}/members/{user_id} — remove member
GET /chat/channels/{id}/messages — list messages (cursor-based pagination)
POST /chat/channels/{id}/messages — send message
PUT /chat/messages/{id} — edit message
DELETE /chat/messages/{id} — soft-delete message
GET /chat/messages/{id}/thread — get thread replies
POST /chat/messages/{id}/reactions — add reaction
DELETE /chat/messages/{id}/reactions/{emoji} — remove reaction
GET /chat/channels/{id}/typing — typing indicator
GET /chat/presence — get team presence map
PUT /chat/presence — set own status
GET /chat/search — full-text + semantic search
New WebSocket (backend/app/api/v1/chat_ws.py — new file):

Endpoint: ws://localhost:8000/api/v1/chat/ws?token={jwt}
One connection per user (not per channel)
Events: message.new, message.edited, message.deleted, typing, presence.changed, reaction.added, read_receipt
Redis pub/sub per channel for multi-instance fan-out (reuse EventBus pattern from core/events.py)
Connection manager class tracking active WS connections by user_id
Heartbeat every 30s for presence TTL refresh
New Frontend Components (expand frontend/src/features/teams/):

chat/ChatSidebar.tsx — team/channel tree, DM list, search, unread badges
chat/ChatPanel.tsx — message list (virtualized via @tanstack/react-virtual), composer, thread panel
chat/MessageItem.tsx — message bubble with reactions, threading indicator, actions menu
chat/MessageComposer.tsx — rich text input, file drag-drop, @mentions autocomplete, slash commands
chat/ThreadPanel.tsx — right-side thread view
chat/ChannelHeader.tsx — channel name, topic, members count, tabs
chat/PresenceIndicator.tsx — green/yellow/red/gray dot
chat/TypingIndicator.tsx — "Alice is typing..."
New Frontend State (frontend/src/store/chat.ts — new file):

Zustand store: activeChannelId, channels[], unreadCounts{}, typingUsers{}, presenceMap{}, messageCache{}
New Frontend API (frontend/src/api/chat.ts — new file):

TanStack Query hooks for all chat endpoints
New WebSocket Hook (frontend/src/hooks/useChatWebSocket.ts — new file):

Follow pattern from useAgentWebSocket.ts (268 lines): exponential backoff, reconnect, event dispatch
Event Bus (add to backend/app/main.py lifespan):

Register: chat.message.sent, chat.channel.created, chat.member.added
Alembic Migration: Single migration for Channel, ChannelMember, ChatMessage, MessageReadReceipt tables

Sprint 3-4 (Weeks 5-8): Teams Hub + AI + ERP Integration
Redesign TeamsPage.tsx — Transform into full Teams hub:

Left sidebar (280px): Teams tree → channels underneath, DMs section, starred channels, search
Center panel: Chat view (default) OR Meeting view (when in call)
Right panel (collapsible): Thread view OR AI Sidebar OR Channel details/members
Bottom: Compose area with rich toolbar
Direct Messages: Auto-create channel_type='direct' with 2 members on first message. Auto-create channel_type='group' for 3+ members.

AI in Chat:

Create system BotUser (is_bot=True flag on User model)
/ask {question} → routes to agent_orchestrator.py, response posted as bot message
/summarize → summarize last 50 messages via Ollama
Smart reply suggestions (3 options) on incoming messages via Ollama
Auto-summary when thread reaches 20+ messages
ERP Notifications in Channels:

Wire existing event bus events to post formatted messages in relevant channels:
pos.sale.completed → post in #sales channel
support.ticket.created → post in #support channel
opportunity.stage_changed → post in deal's auto-channel
task.status.changed → post in project's auto-channel
Use content_type='card' for rich ERP entity cards (invoice preview, task card, ticket summary)
File Sharing: Drag-drop in composer → upload to MinIO (urban-erp-chat-files bucket) → create DriveFile entry → embed file card in message.

Notifications: Wire chat.message.sent to create Notification records for @mentions and DMs. Reuse existing Notification model.

Search: Postgres tsvector for full-text search. pgvector embeddings via Ollama for semantic search.

Phase 2: Power Features (Months 2-4)
Month 2: Channels Expansion + Calling
Channel Tabs: ChannelTab model (channel_id, tab_type, config JSON, position). Auto-tabs: Files, Notes. Custom: Tasks, Dashboard, Form, URL.
Pinned Messages: is_pinned, pinned_by, pinned_at on ChatMessage
Bookmarked Messages: UserBookmark model (user_id, message_id)
1:1 Audio/Video Calls: Click "Call" in DM → create ephemeral Jitsi room via existing jitsi.py. Redis-based call state management.
Shared Channels: ChannelTeamLink for cross-team channel sharing
Channel Templates: Predefined setups for Engineering, Sales, Support teams
Month 3: Meeting AI + Transcription
Live Transcription: Deploy faster-whisper as urban-erp-whisper Docker container. MeetingTranscript model (meeting_id, timestamp, speaker_id, text, confidence). Jitsi audio → Whisper via WebSocket.
AI Meeting Summary: On meeting.ended event → Celery task: fetch transcript → Ollama summarization → extract action items → create Project tasks → post to linked channel → update PostMeetingSummary.tsx
Whiteboard: Embed tldraw (MIT) as React component. Store state in MinIO as JSON. Share in channels and meetings.
Breakout Rooms: Manage from Y&U UI with timer + auto-return
Month 4: Workflows + Bots + Adaptive Cards
Slash Command Registry: SlashCommand model. Built-in: /task, /remind, /poll, /ask, /summarize, /approve, /escalate, /invoice
Incoming Webhooks: IncomingWebhook model. POST /api/v1/chat/webhooks/{token} → message in channel
Outgoing Webhooks: OutgoingWebhook model. Trigger on keyword match → POST to external URL
Chat-Triggered ERP Actions: /approve PO-{id} → supply chain approval. /invoice {contact} {amount} → finance invoice. All via ToolExecutor with approval tiers.
Adaptive Cards: Rich interactive cards: Invoice approval (Accept/Reject), Leave request, PO approval, Task assignment, Meeting RSVP
Phase 3: Enterprise & Mobile (Months 4-6)
Month 5: Compliance + Analytics
Message Retention: RetentionPolicy model. Celery beat job purges expired messages. Legal hold flag prevents deletion.
DLP Rules: DLPRule model (pattern_regex, action: warn|block|redact). Check on message save. AI-assisted for unstructured data.
eDiscovery: Admin search across all messages by date/user/keywords. Export JSON/CSV.
Chat Audit Log: ChatAuditLog model. Log all edits, deletions, member changes, permission changes.
Teams Analytics Dashboard: messages/day, active users, top channels, response times, meeting frequency, file shares
Month 6: Mobile + Live Events + Polish
PWA: Service worker for caching. Web Push for notifications. manifest.json. IndexedDB via Dexie.js for offline messages.
Live Events: LiveEvent model (title, type, start_time, max_attendees, registration, Q&A, polls). Reuse Jitsi large-meeting mode + Forms for polls + CRMComment threading for Q&A.
Smart Notifications: AI priority scoring (sender importance, @mention, keyword, time sensitivity). Batch low-priority into digests.
Sentiment Analysis: Ollama-powered sentiment tagging. Team morale dashboard in HR.
Knowledge Base Integration: Auto-suggest Handbook articles when questions are asked in channels.
SECTION 4: TECHNICAL RECOMMENDATIONS
Database Design
All chat tables use existing Base, UUIDPrimaryKeyMixin, TimestampMixin from backend/app/models/base.py
ChatMessage has tsvector column for full-text + Vector(384) for semantic search
Cursor-based pagination for messages (cursor = created_at, id) — NOT OFFSET/LIMIT
Consider partitioning chat_messages by month if volume exceeds 10M rows
WebSocket Architecture
One WS connection per user (not per channel) — multiplexed
Flow: Client → WS → Backend validates + saves DB → publishes to Redis channel → all subscribers receive
Redis pub/sub channel per chat channel: chat:channel:{channel_id}
Presence: heartbeat every 30s, Redis SET with TTL 60s, broadcast presence.offline on miss
Typing: throttle 1 event/3s, pure pub/sub (no persistence)
Connection manager class: Dict[user_id, Set[WebSocket]]
Redis Usage (existing Redis 7 container — no new container needed)
chat:channel:{channel_id} — pub/sub for real-time delivery
presence:{user_id} — JSON status + TTL 60s
typing:{channel_id}:{user_id} — SET with TTL 5s
unread:{user_id}:{channel_id} — counter
File Storage
New MinIO bucket: urban-erp-chat-files
Reuse existing MinIO integration from backend/app/integrations/
Presigned URLs for downloads (existing Drive pattern)
Celery task for image thumbnail generation
Frontend Architecture
Expand frontend/src/features/teams/ with subdirs: chat/, channels/, meetings/ (existing), calls/
Virtualized message list via @tanstack/react-virtual for 10K+ message performance
New Zustand store: store/chat.ts
New API client: api/chat.ts
New WebSocket hook: hooks/useChatWebSocket.ts (follow useAgentWebSocket.ts pattern)
Docker Impact
Phase 1: 0 new containers (chat is FastAPI + Redis logic in existing stack)
Phase 2: +1 container (urban-erp-whisper for transcription) = 15 total
Phase 3: 0 new containers
Performance Targets
Message delivery: <100ms (WS + Redis pub/sub)
Message history load: <200ms for 50 messages
Search: <500ms full-text, <1s semantic
Presence propagation: <2s
File upload: <3s for <10MB
SECTION 5: 5 BOLD Y&U TEAMS-ONLY DIFFERENTIATORS
1. "ERP-Aware Chat" — The Only Chat That Understands Your Business
Microsoft Teams has zero knowledge of invoices, POs, or production schedules. Y&U Teams has access to 250+ models and 400+ endpoints. Type "How's the Acme deal?" → Y&U pulls the actual CRM deal stage, associated invoices, support tickets, and project tasks inline. Every message is contextually enriched with live ERP data. No other product can do this because no other product owns both the chat layer and the entire ERP data model.

Implementation: Wire ToolExecutor from ai_tools.py to respond to natural language in chat. The 100+ tools become chat superpowers. Existing TOOL_APPROVAL_TIERS ensures sensitive operations need approval.

2. "Zero-Config Auto-Channels" — Channels That Create Themselves
When a CRM deal is created, a project starts, or a support ticket escalates → Y&U auto-creates a channel with the right people, files, and tabs pre-configured. The channel auto-archives when the entity closes. No manual channel management. No channel sprawl.

Implementation: Event bus handlers for opportunity.created, project.created, support.ticket.escalated auto-create channels with pre-populated ChannelTabs + auto-added members from existing TeamMember associations.

3. "Cross-Module Action Threads" — Chat Threads That Do Work
A thread is not just a conversation — it's an execution context. From one thread about a customer complaint: create support ticket + credit memo + quality hold + follow-up meeting + CRM sentiment update — all without leaving the thread. Each action logged as an interactive card with full audit trail. The thread becomes the single source of truth.

Implementation: content_type='action' messages with structured payload: {action, params, result, status}. Rendered as interactive cards. Executed via existing ToolExecutor with approval tiers.

4. "AI Decision Memory" — Every Decision, Forever Findable
AI detects decisions in threads ("let's go with Option B"), logs them as formal Decision records with context, participants, rationale, and linked ERP entities. Months later, ask "Why did we choose vendor X?" → AI surfaces the exact conversation moment. Microsoft Teams loses this in infinite scroll.

Implementation: Decision model with pgvector embedding for semantic retrieval. AI scans for decision language patterns, creates drafts for confirmation.

5. "100% Data Sovereignty with Zero Compromise"
Every byte stays on your infrastructure. Chat, recordings, transcripts, files, AI inference — all self-hosted. Ollama never sends data externally. Jitsi never routes through external TURN servers. Stalwart mail never touches external SMTP. Unlike Rocket.Chat or Mattermost that only handle chat, Y&U owns the entire ERP stack — no data leakage through integrations.

Implementation: Already architecturally complete. Add a "Data Sovereignty Dashboard" showing where all data is stored with zero external API calls.

CRITICAL FILES TO MODIFY/CREATE
New Files (Phase 1):
File	Purpose
backend/app/models/chat.py	Channel, ChannelMember, ChatMessage, MessageReadReceipt models
backend/app/api/v1/chat.py	Chat REST API (18+ endpoints)
backend/app/api/v1/chat_ws.py	Chat WebSocket endpoint + connection manager
backend/app/schemas/chat.py	Pydantic request/response schemas
frontend/src/features/teams/chat/ChatSidebar.tsx	Channel/DM navigation
frontend/src/features/teams/chat/ChatPanel.tsx	Message list + composer
frontend/src/features/teams/chat/MessageItem.tsx	Individual message rendering
frontend/src/features/teams/chat/MessageComposer.tsx	Rich text input
frontend/src/features/teams/chat/ThreadPanel.tsx	Thread view
frontend/src/features/teams/chat/ChannelHeader.tsx	Channel header bar
frontend/src/features/teams/chat/PresenceIndicator.tsx	Status dot
frontend/src/features/teams/chat/TypingIndicator.tsx	Typing state
frontend/src/store/chat.ts	Zustand chat state
frontend/src/api/chat.ts	TanStack Query hooks
frontend/src/hooks/useChatWebSocket.ts	Chat WebSocket hook
Existing Files to Modify:
File	Change
backend/app/models/user.py	Add is_bot flag to User model
backend/app/api/v1/__init__.py	Register chat router
backend/app/main.py	Register chat event bus handlers
backend/app/core/integration_handlers.py	Add ERP→channel notification handlers
backend/app/services/ai_tools.py	Add chat AI tools + approval tiers
frontend/src/features/teams/TeamsPage.tsx	Redesign into full Teams hub
frontend/src/App.tsx	Add chat routes
docker-compose.yml	Add whisper container (Phase 2)
Existing Files to Reuse (patterns/code):
File	Reuse
backend/app/core/events.py	EventBus pattern for chat pub/sub
frontend/src/hooks/useAgentWebSocket.ts	WebSocket hook pattern (reconnect, backoff)
backend/app/models/crm_collaboration.py	Threading pattern (parent_id), mentions pattern
backend/app/services/agent_orchestrator.py	AI tool execution for chat commands
backend/app/integrations/jitsi.py	Jitsi room creation for 1:1 calls
backend/app/models/base.py	Base, UUIDPrimaryKeyMixin, TimestampMixin
VERIFICATION PLAN
Phase 1 Verification:
Chat Flow: Create team → create channel → send message → verify WebSocket delivery <100ms → edit message → delete message → verify read receipts
Threading: Reply to message → verify thread panel opens → verify thread count badge
Presence: Log in as User A → verify green dot → close tab → verify gray dot within 60s
DMs: Click user → verify DM channel auto-created → send message → verify notification
AI: Type /ask What's the revenue this month? → verify AI bot responds with actual finance data
File Share: Drag file into composer → verify upload to MinIO → verify file card in message → verify file in Drive
ERP Notifications: Create a support ticket → verify message posted to #support channel
Search: Send 50 messages → search by keyword → verify results <500ms → search semantically → verify relevant results
Docker: docker compose up -d --build → verify no new containers needed → docker compose exec backend alembic upgrade head → verify migration runs clean
Load Test: Send 100 messages/second to a channel with 50 members → verify all members receive within 200ms