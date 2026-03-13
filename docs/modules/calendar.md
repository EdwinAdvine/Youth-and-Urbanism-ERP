# Calendar & Meetings Module

> Smart scheduling, event management, video meetings, and calendar analytics.

## Overview

The Calendar module provides a full-featured scheduling system with AI-powered smart scheduling, resource booking, focus time management, and deep integration with Mail (auto-detect events from emails), Projects (task deadlines), and HR (approved leave).

**Who uses it:** All users (personal calendar), Calendar Admins (resource management)
**Requires:** Authenticated user (personal calendar), calendar.admin for resource management

---

## Features

- **Event management** — create, edit, recurring events with full attendee management
- **Smart scheduling** — AI finds free slots across attendee calendars
- **Focus time** — block deep work time, auto-decline meetings during focus blocks
- **Resource booking** — meeting rooms, equipment, shared resources with availability
- **Calendar analytics** — time spent per category, meeting ROI, collaboration metrics
- **Group calendars** — shared team/department calendars
- **CalDAV sync** — bi-directional sync with Apple Calendar, Thunderbird, Google Calendar
- **Mail scanning** — auto-detect meeting invitations and event details from emails
- **Webhook integrations** — notify external systems on event changes
- **AI scheduling** — suggest optimal meeting times, detect conflicts
- **Task sync** — project task deadlines appear as calendar events
- **Meeting recordings** — Jitsi recordings saved to Drive, linked to calendar events

---

## Architecture

### Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/calendar_router.py` | Core CRUD: events, attendees, recurring patterns |
| `backend/app/api/v1/calendar_ai_router.py` | AI scheduling and smart suggestions |
| `backend/app/api/v1/calendar_analytics.py` | Time analytics and meeting ROI reports |
| `backend/app/api/v1/calendar_attachments.py` | File attachments on calendar events |
| `backend/app/api/v1/calendar_automation.py` | Auto-create events from other modules |
| `backend/app/api/v1/calendar_focus.py` | Focus time blocks management |
| `backend/app/api/v1/calendar_group.py` | Team/group shared calendars |
| `backend/app/api/v1/calendar_mail_scanner.py` | Parse emails for event details |
| `backend/app/api/v1/calendar_resources.py` | Meeting room and resource booking |
| `backend/app/api/v1/calendar_roi.py` | Meeting cost and ROI calculation |
| `backend/app/api/v1/calendar_scheduling.py` | Smart scheduling engine |
| `backend/app/api/v1/calendar_webhooks.py` | External webhook notifications |
| `backend/app/api/v1/meetings.py` | Meeting management (Jitsi integration) |
| `frontend/src/features/calendar/` | Calendar UI pages |
| `frontend/src/api/calendar.ts` | Calendar API client hooks |

---

## Data Models

| Model | Table | Description |
|-------|-------|-------------|
| `CalendarEvent` | `calendar_events` | A calendar event with time, location, description |
| `EventAttendee` | `calendar_event_attendees` | Attendee (user or external email) + RSVP status |
| `RecurringRule` | `calendar_recurring_rules` | RRULE for repeating events |
| `CalendarResource` | `calendar_resources` | Bookable resource (room, projector, car) |
| `FocusBlock` | `calendar_focus_blocks` | Deep work time block |
| `MeetingLink` | `meeting_links` | Jitsi meeting URL linked to a calendar event |

---

## Workflows

### Creating a Meeting

1. User opens Calendar → New Event
2. Sets title, date/time, duration
3. Adds attendees (users or external emails)
4. Optionally books a resource (meeting room)
5. Backend: creates CalendarEvent + EventAttendee records
6. Backend: publishes `calendar.event.created` → Notifications module sends invitations
7. If Jitsi enabled: creates a Jitsi room → stores link in MeetingLink

### Smart Scheduling Flow

1. User selects attendees for a new meeting
2. Frontend calls `POST /calendar/scheduling/find-slots`
3. Backend queries all attendees' calendars for free slots
4. AI ranks slots by: time-of-day preferences, travel time, focus block conflicts
5. Frontend shows top 3–5 suggested slots
6. User picks a slot → meeting created with one click

### CalDAV Sync

- CalDAV endpoint: `http://backend:8000/caldav/{user_id}/`
- Bi-directional: changes in external apps sync to Urban Vibes Dynamics and vice versa
- Used for Apple Calendar, Thunderbird, Outlook integration

---

## Cross-Module Integrations

| Source | Trigger | Calendar Action |
|--------|---------|-----------------|
| Meetings API | Meeting created | Auto-create CalendarEvent for all attendees |
| Projects | Task due date set | Create calendar reminder event |
| HR | Leave approved | Block calendar as "Out of Office" |
| Mail | Email contains meeting invitation | Suggest creating CalendarEvent |
| Mail scanner | Email body analyzed | Extract date/time/location → pre-fill event form |
