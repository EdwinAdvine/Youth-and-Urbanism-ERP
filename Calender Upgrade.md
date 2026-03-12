Ready for review
Select text to add comments on the plan
Era Calendar Mega-Upgrade Plan
Context
Era Calendar currently has a solid foundation: 3 core models, 45+ endpoints, 10 frontend components, 4 views (month/week/day/agenda), recurring events, RSVP, iCal subscriptions, Jitsi integration, AI scheduling assistant, and cross-module soft links. However, to compete with Outlook Calendar 2026 + Reclaim.ai + Motion + Calendly Enterprise, we need dramatic upgrades across views, AI intelligence, time management, booking, analytics, and enterprise features — all supercharged by native Era ERP integration that no competitor can match.

1. GAP ANALYSIS
Views & Sharing
Feature	Status	How to Match/Beat
Day View	Partial — list-based, no hourly grid	Build a true hourly time-grid (6am-midnight, 30-min slots) with drag-to-create and drag-to-resize events, like Outlook/Google
Week View	Partial — compact card grid, no time axis	Full 7-column time-grid with horizontal time ruler, overlapping event stacking, and drag-resize
Month View	Yes — functional grid with DnD	Add multi-day event spanning bars, week-number gutter, and "more events" expandable popover
Agenda View	Yes — grouped list	Add inline event editing, ERP context badges (invoice #, ticket #), and infinite scroll
Schedule/Timeline View	No	NEW: Horizontal timeline per-resource (people, rooms, equipment) — critical for team visibility
Year View	No	NEW: Heat-map year grid showing event density per day (like GitHub contributions)
Calendar Overlays	Partial — MultiCalendarSidebar toggles sources	Add transparent color overlays when viewing multiple calendars simultaneously, with opacity controls
Shared Calendars with Permissions	Partial — CalendarShareDialog (view/edit/manage)	Add granular permission model: free/busy only, read details, propose changes, full edit. Add team/department auto-sharing
Group Calendars	No	NEW: Department/team calendars that auto-aggregate member events. Auto-created per HR department
Team Availability Overlay	Partial — SchedulingAssistant shows grid	Embed availability overlay directly into week/day views (ghost blocks showing teammates' busy times)
Scheduling & Booking
Feature	Status	How to Match/Beat
AI Scheduling Assistant	Partial — availability grid, manual selection	Upgrade to auto-suggest top 3 optimal times considering all attendees, time zones, preferences, and ERP deadlines. One-click accept
AI Copilot (email-to-meeting)	No	NEW: AI scans incoming Era Mail for scheduling intent, auto-drafts calendar events with pre-filled attendees, subject, and linked mail thread
Booking Pages / Scheduling Links	No	NEW: Public booking pages per user (like Calendly). Custom branding, event types, buffer times, availability rules. Embeddable widget
Dynamic Availability with Priority	No	NEW: Priority-based availability — low-priority events yield slots to high-priority requests. AI auto-negotiates
Rule-Based Auto-Accept/Reject	No	NEW: Configurable rules engine — auto-accept from VIP contacts, auto-reject if over daily meeting limit, auto-tentative for large groups
Buffer Time Between Events	No	NEW: Configurable pre/post event buffers (5-30 min). Auto-enforced when scheduling
Travel Time Estimation	No	NEW: Auto-add travel time blocks between in-person events based on location distance
Time Management & Automation
Feature	Status	How to Match/Beat
Automatic Time Blocking	No	NEW: AI analyzes tasks from Projects module, auto-blocks focus time slots on calendar. Respects user preferences (morning deep work, afternoon meetings)
Focus Time Protection	No	NEW: Designated "focus hours" that block meeting requests. Visual shield icon on calendar. Auto-decline meeting invites during focus time
Smart Rescheduling	No	NEW: When conflicts arise, AI proposes alternative times for lower-priority events. One-click cascade reschedule
Tasks & To-Do Sync	Partial — task.created event creates calendar event	Deep two-way sync: drag tasks onto calendar to schedule, task completion updates calendar, calendar changes update task due dates
Natural Language Event Creation	No	NEW: "Schedule a finance review with Amina next Tuesday at 2pm" → parsed into full event with attendee lookup, ERP context
Custom Rules & Automations	No	NEW: Visual automation builder — "When invoice overdue > 7 days → auto-schedule follow-up call with client"
Recurring Events	Yes — full RRULE support	Add exception dates, "this and following" edit mode, series vs instance editing UX
Reminders	Partial — 15-min Celery check	Add multi-reminder support (5min, 15min, 1hr, 1day), custom reminder times, push + email + in-app notification channels
Time Zones	Partial — events store UTC	Add per-event timezone display, world clock sidebar for multi-TZ teams, automatic DST handling display
Drag-to-Create Events	Partial — click-to-create only	Add click-and-drag on time grid to create event with pre-filled start/end time
ERP Integrations
Feature	Status	How to Match/Beat
Finance → Calendar	Partial — ComplianceCalendarPage	Deep: Auto-calendar invoice due dates, payment reminders, budget review meetings. Click event → see invoice details inline
Mail → Calendar	Partial — email invites sent on event creation	Two-way: Parse incoming .ics attachments (already have mail_parser), AI detect scheduling intent in emails, email thread linked to event
Support → Calendar	No	NEW: Auto-schedule SLA deadline events, customer callback slots, escalation meetings. Ticket context auto-pulled into event
Projects → Calendar	Partial — task deadlines as events, MeetingLink	Deep: Sprint planning auto-blocks, milestone events, project timeline overlay on calendar, Gantt-to-calendar sync
HR → Calendar	Yes — leave calendar, holiday calendar	Add: Onboarding schedule auto-generation, performance review scheduling, birthday/anniversary auto-events
CRM → Calendar	Partial — MeetingLink to contacts/deals	Deep: Deal stage auto-triggers follow-up scheduling, pipeline review meetings with revenue data, client meeting prep with deal history
E-Commerce → Calendar	No	NEW: Flash sale scheduling, inventory restock reminders, supplier meeting scheduling with PO context
Supply Chain → Calendar	No	NEW: Delivery schedule events, procurement review meetings, supplier lead time tracking
Manufacturing → Calendar	No	NEW: Production run scheduling, maintenance windows, shift calendar integration
Insights & Analytics
Feature	Status	How to Match/Beat
Meeting Insights & Prep	Partial — AI summarize post-meeting	NEW: Pre-meeting prep cards — auto-pull attendee CRM profiles, recent deals, open support tickets, last meeting notes, relevant invoices
Meeting Analytics	No	NEW: Dashboard — meetings/week trend, avg duration, top collaborators, meeting-free days, cost per meeting (salary-weighted), time in recurring vs ad-hoc
Productivity Insights	No	NEW: Focus time ratio, meeting load score, scheduling efficiency, suggested optimizations
ERP-Linked ROI	No	NEW: Revenue attributed to client meetings, support cost per meeting, project time tracking from calendar
Sentiment Analysis	No	NEW: AI analyzes meeting notes/chat for sentiment trends. Flag declining client relationships
Offline & Security
Feature	Status	How to Match/Beat
Offline Access	No	NEW: Service Worker cache for upcoming 2 weeks of events. IndexedDB sync queue for offline edits
Mobile Sync	Partial — responsive UI, swipe gestures	PWA with push notifications, native-feel calendar widget
Event Attachments	No	NEW: Attach files from Era Drive/MinIO to events. Preview in event detail
Sensitivity Labels	No	NEW: Confidential/Internal/Public labels on events. Controls visibility in shared views
Encryption	Partial — HTTPS transport	Add at-rest encryption for event descriptions containing sensitive data
Compliance Logging	No	NEW: Audit trail for all calendar changes (who changed what, when). Required for regulated industries
Data Loss Prevention	No	NEW: Prevent sharing confidential events externally. Block export of sensitive events
Other
Feature	Status	How to Match/Beat
Resource Booking	No	NEW: Book rooms, equipment, vehicles. Real-time availability grid. Conflict detection
Custom Event Types & Templates	Partial — MeetingTemplate exists	Extend: Custom event type definitions with conditional fields (e.g., "Client Call" type auto-adds CRM contact picker)
Event Attachments & Notes	Partial — MeetingNote exists	Add file attachments, rich-text notes with @mentions, linked Era Docs
Video Conferencing Links	Yes — Jitsi auto-create	Add: One-click join button prominent in event, auto-start recording option
Voice Dictation	No	NEW: Voice-to-event via browser Speech API — "Create a meeting with finance team Friday 3pm about Q2 budget"
API Access & Add-Ins	Partial — REST API exists	Add: Webhook subscriptions for external integrations, calendar API docs, OAuth2 for third-party apps
Sandbox/Testing	No	LOW PRIORITY: Admin can preview automation rules before enabling
2. MODERN AI-ERA ENHANCEMENTS (2026 Features)
Views & Sharing
ERP Context Badges on Events — Every event shows inline badges: invoice amount, ticket priority, deal stage, task status. Click badge → navigate to that ERP record. No competitor has this.
AI Calendar Lens — Toggle an AI overlay that color-codes your week by "revenue-generating" vs "internal" vs "admin" time. Shows a productivity score.
Smart Team Scheduler — When creating a group event, AI shows each person's ideal meeting windows considering their focus time preferences, timezone, and current workload from Projects.
Scheduling & Booking
One-Click "Invoice Meeting" — Create an event that auto-links to a Finance invoice, pulls client data from CRM, and schedules a follow-up if payment isn't received by due date.
AI Proactive Scheduling — AI monitors Era Mail, Support tickets, and Project deadlines. Proactively suggests: "You have 3 overdue support tickets from Acme Corp — schedule a call?" One-click creates event with full context.
SLA-Aware Auto-Scheduling — AI predicts upcoming SLA breaches from Support module and auto-blocks callback slots before deadlines hit. No manual intervention needed.
Time Management & Automation
Cash-Flow Aware Rescheduling — When Finance module detects a cash-flow alert, AI auto-reschedules non-critical internal meetings to free up time for revenue-critical client calls.
Deep Work AI — AI learns your peak productivity hours from task completion patterns and auto-protects those slots. Gradually optimizes over weeks.
Cross-Module Automation Builder — Visual no-code builder: "When Deal stage = Negotiation → Schedule weekly check-in with client → Auto-pull latest quote from Finance → Add to event notes."
ERP Integrations
Live Revenue Dashboard in Meeting Prep — Before any client meeting, AI auto-generates a prep card: YTD revenue, open invoices, pending quotes, support satisfaction score, last 5 interactions — all pulled live from Finance + CRM + Support.
Inventory-Aware Scheduling — When scheduling supplier meetings, AI pulls current stock levels, pending POs, and lead times from Supply Chain. Event notes auto-populated.
HR-Integrated Capacity Planning — Calendar shows team capacity considering approved leaves, holidays, and project allocations. Prevents over-scheduling absent team members.
Insights & Analytics
Meeting ROI Calculator — For every client meeting, calculate: attendee salary cost + opportunity cost vs. revenue generated from that client. Dashboard shows ROI trends.
AI Meeting Coach — Post-meeting, AI analyzes notes + chat sentiment and gives coaching tips: "Your last 3 calls with Client X had declining sentiment. Consider scheduling an in-person visit."
Predictive Scheduling Intelligence — AI predicts your next week's scheduling conflicts based on patterns and proactively resolves them before Monday morning.
Offline & Security
Encrypted Confidential Events — Events tagged "Confidential" have descriptions encrypted at rest. Only attendees with clearance can view details. Others see "Confidential Meeting."
Compliance Time Tracker — Auto-log time spent on compliance-related events. Auto-generate audit reports for regulators.
Offline-First PWA — Full offline calendar with background sync. Create/edit events offline, auto-merge when reconnected. Conflict resolution UI.
3. PRIORITIZED 6-MONTH ROADMAP
Phase 1: MVP (Weeks 1-8) — Core Views + ERP Integration + Basic AI
Week 1-2: Time-Grid Views

 Build hourly time-grid component (shared by Day & Week views) — 30-min slots, 6am-midnight
 Day View with time-grid, drag-to-create, drag-to-resize events
 Week View with 7-column time-grid, overlapping event stacking
 Upgrade Month View — multi-day event spanning bars, expandable "+more" popover
 Year View — heat-map grid (event density per day)
Week 3-4: Deep ERP Integration

 Finance → Calendar: Auto-create events for invoice due dates, payment reminders
 Support → Calendar: SLA deadline events, auto-schedule customer callbacks
 Projects → Calendar: Two-way task ↔ calendar sync (drag tasks to schedule)
 CRM → Calendar: Deal follow-up auto-scheduling, client context on events
 ERP Context Badges on all event cards (invoice #, ticket #, deal stage, task status)
 Pre-meeting prep cards: Auto-pull attendee CRM + Finance + Support data
Week 5-6: AI Scheduling Intelligence

 AI auto-suggest optimal meeting times (top 3 slots considering all constraints)
 Natural language event creation: parse free-text into structured event
 AI email-to-calendar: Scan Era Mail for scheduling intent, draft events
 Multi-reminder support (5min, 15min, 1hr, 1day) with channel selection
 Time zone display per-event + world clock sidebar
Week 7-8: Shared Calendars & Permissions

 Granular permission model: free/busy only, read, propose, full edit
 Group/Department calendars (auto-aggregate from HR departments)
 Team availability overlay in week/day views (ghost busy blocks)
 Calendar overlay mode (transparent color layers for multiple calendars)
 Schedule/Timeline view (horizontal per-person timeline)
Phase 2: Full AI + Booking + Tasks (Months 3-4)
Month 3: Agentic AI & Automation

 Proactive AI scheduling agent (monitors Mail, Support, Projects — suggests events)
 Rule-based auto-accept/reject (VIP contacts, daily meeting limits)
 Smart rescheduling (AI proposes alternatives on conflicts)
 Focus Time Protection (designated hours, auto-decline during focus)
 Cross-module automation builder (visual no-code rules)
 Cash-flow aware rescheduling (Finance alerts → free up time for revenue calls)
Month 4: Booking Pages + Task Sync + Mobile

 Public booking pages per user (Calendly-style: custom branding, event types, buffers)
 Embeddable booking widget for Era website/e-commerce
 Buffer time between events (configurable pre/post)
 Deep two-way task ↔ calendar sync with auto-prioritization
 Automatic time blocking for tasks based on priority and estimated duration
 PWA enhancements: push notifications, native-feel mobile experience
Phase 3: Analytics + Enterprise (Months 5-6)
Month 5: Analytics & Insights

 Meeting analytics dashboard (meetings/week, avg duration, top collaborators, cost)
 Productivity insights (focus ratio, meeting load, scheduling efficiency)
 Meeting ROI calculator (salary cost vs revenue generated per client)
 AI Meeting Coach (sentiment analysis + coaching tips)
 Predictive scheduling (AI resolves next week's conflicts proactively)
Month 6: Enterprise & Resource Booking

 Resource booking (rooms, equipment, vehicles) with real-time availability
 Custom event types with conditional fields
 Event attachments from Era Drive/MinIO
 Sensitivity labels (Confidential/Internal/Public) with visibility controls
 Compliance audit logging (full change trail)
 Offline-first PWA with IndexedDB sync queue
 Voice-to-event via browser Speech API
 Webhook subscriptions for external integrations
 API documentation + OAuth2 for third-party apps
4. TECHNICAL RECOMMENDATIONS
Frontend
Keep: React 18 + TypeScript + Vite + TanStack Query + Zustand + Tailwind + Radix UI (already excellent)
Add: Custom time-grid component built on CSS Grid (no external calendar library needed — full control over UX)
Add: date-fns or dayjs for timezone-aware date math (lighter than moment)
Add: rrule.js for client-side recurrence expansion (already implied)
Add: Zustand calendar store for complex view state (selected date, view mode, visible calendars, drag state)
Add: Framer Motion for smooth event drag/resize animations
Add: Service Worker + IndexedDB (via idb library) for offline support
Backend
Keep: FastAPI + SQLAlchemy 2.0 async + Alembic + Celery + Redis (already excellent)
Add new models: BookingPage, BookingSlot, CalendarPermission, Resource, ResourceBooking, CalendarRule, EventAttachment, AuditLog, FocusTimeBlock
Add: WebSocket real-time calendar updates (extend existing event bus → push to connected clients)
Add: python-dateutil rrule for server-side recurrence (more robust than current manual expansion)
Add: NLP endpoint using Ollama for natural language event parsing
Real-Time Sync
Redis pub/sub (already have) → extend to push calendar updates via WebSocket to all calendar viewers
Server-Sent Events (SSE) as lightweight alternative for one-way push (event created/updated/deleted notifications)
Optimistic updates on frontend with TanStack Query mutation callbacks
AI/LLM
Ollama (already primary) for: natural language parsing, meeting prep generation, sentiment analysis, scheduling suggestions
Agent system (already have Urban Bad AI) for: proactive scheduling agent, cross-module automation execution
Vector embeddings (pgvector already in stack) for: semantic search across meeting notes, finding related events/context
Auth & Security
Keep: JWT auth (already have)
Add: Per-calendar ACL model (CalendarPermission table)
Add: Event-level sensitivity labels with query filters
Add: Audit log table with automatic triggers
5. COMPETITIVE EDGE — 5 "ERA CALENDAR-ONLY" DIFFERENTIATORS
1. Live ERP Intelligence on Every Event
No calendar in the world shows live invoice amounts, deal stages, support ticket statuses, and project progress directly on calendar events. Era Calendar turns every time slot into a business intelligence dashboard. Click any client meeting → instantly see their revenue, open invoices, satisfaction score, and pending deliverables. Outlook and Google Calendar are isolated apps. Era Calendar IS the business.

2. AI That Schedules From Business Context, Not Just Free Slots
Reclaim.ai and Motion optimize for open time slots. Era Calendar's AI optimizes for business outcomes: it knows which clients drive the most revenue (Finance), which support tickets are about to breach SLA (Support), which deals are stuck in pipeline (CRM), and which projects are behind schedule (Projects). It proactively creates the meetings that matter most and deprioritizes the ones that don't.

3. Cross-Module Automation Engine
"When invoice overdue > 7 days → auto-schedule follow-up → pull client history → notify account manager → create support ticket if no response in 48 hours." This chain spans Finance → Calendar → CRM → Support — impossible in any other calendar because they don't own the ERP. Era Calendar is the orchestration layer for the entire business.

4. Zero-Integration, Native Everything
Outlook needs Dynamics 365 connectors. Google Calendar needs Zapier. Calendly needs API webhooks. Era Calendar has zero integrations to configure — Finance, Mail, Support, Projects, HR, CRM, E-Commerce, Manufacturing, and Supply Chain data flows natively in real-time. No sync delays, no broken webhooks, no third-party middleware fees. It just works.

5. Meeting ROI — Know the Dollar Value of Every Hour
Era Calendar is the only calendar that can tell you: "This 1-hour client meeting with Acme Corp cost $450 in attendee salary but generated $12,000 in closed deals this quarter." By connecting Calendar → Finance → CRM → HR salary data, businesses can finally measure and optimize their most expensive resource: time. No competitor can even approximate this because they don't have the financial data.

6. KEY FILES TO MODIFY/CREATE
Backend — Modify
calendar.py — Add new fields (sensitivity, buffer_before, buffer_after, timezone, attachments)
calendar_router.py — Enhance CRUD with new fields
calendar_ext.py — Add booking, resource, automation endpoints
meetings_ext.py — Add meeting prep, analytics endpoints
ai_tools.py — Add NLP event parsing, proactive scheduling tools
integration_handlers.py — Add Finance/Support/CRM → Calendar auto-events
celery_app.py — Add SLA monitoring, proactive scheduling tasks
Backend — Create
backend/app/models/booking.py — BookingPage, BookingSlot models
backend/app/models/resource.py — Resource, ResourceBooking models
backend/app/models/calendar_permission.py — CalendarPermission, CalendarRule models
backend/app/models/calendar_audit.py — CalendarAuditLog model
backend/app/api/v1/booking.py — Public booking page endpoints
backend/app/api/v1/calendar_analytics.py — Meeting analytics, ROI endpoints
backend/app/api/v1/calendar_resources.py — Resource booking endpoints
backend/app/api/v1/calendar_automation.py — Automation rules CRUD
backend/app/services/calendar_ai.py — NLP parsing, proactive scheduling, meeting prep generation
backend/app/services/calendar_analytics.py — Analytics computation service
Frontend — Modify
CalendarPage.tsx — New time-grid views, overlay mode, ERP badges
SchedulingAssistant.tsx — AI auto-suggest, NLP input
EventDetailPopover.tsx — ERP context cards, attachments, prep
MultiCalendarSidebar.tsx — Permissions, group calendars, overlays
Frontend — Create
frontend/src/features/calendar/TimeGrid.tsx — Shared hourly time-grid component
frontend/src/features/calendar/YearView.tsx — Heat-map year view
frontend/src/features/calendar/ScheduleView.tsx — Horizontal timeline per-resource
frontend/src/features/calendar/BookingPage.tsx — Public booking page builder
frontend/src/features/calendar/BookingWidget.tsx — Embeddable booking widget
frontend/src/features/calendar/MeetingPrepCard.tsx — Pre-meeting ERP context card
frontend/src/features/calendar/CalendarAnalytics.tsx — Analytics dashboard
frontend/src/features/calendar/AutomationBuilder.tsx — Visual rule builder
frontend/src/features/calendar/ResourceBooking.tsx — Resource booking UI
frontend/src/features/calendar/FocusTimeManager.tsx — Focus time configuration
frontend/src/store/calendar.ts — Zustand calendar state store
frontend/src/api/calendar_analytics.ts — Analytics API hooks
frontend/src/api/booking.ts — Booking page API hooks
frontend/src/api/calendar_resources.ts — Resource booking API hooks
7. VERIFICATION
Phase 1 Testing
Time-grid views: Open Day/Week views → verify hourly grid renders, drag-to-create works, events resize properly
ERP integration: Create event linked to invoice → verify badge shows, click navigates to Finance
AI scheduling: Type natural language → verify event created correctly. Check AI suggestions match attendee availability
Shared calendars: Share calendar with teammate → verify permission levels enforce correctly
Run existing tests: pytest backend/tests/test_calendar_*.py — all must pass
New tests: Add tests for booking, analytics, resource, automation endpoints
Frontend: npm run build — zero TypeScript errors. Manual test all 6 views render correctly
Docker: docker compose up -d --build && docker compose exec backend alembic upgrade head — all services healthy