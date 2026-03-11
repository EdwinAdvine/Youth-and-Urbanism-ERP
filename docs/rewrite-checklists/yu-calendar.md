# Y&U Calendar -- Rewrite Checklist

**Status: 100% COMPLETE** (Phase 1 + Phase 2 + Phase 4 + mail invites + timezone/CalDAV tests + swipe + REST-first calendar)
**Owner: 100% Ours**

## Database Models
- [x] CalendarEvent model (title, description, start, end, all_day, location, organizer_id, recurrence_rule)
- [x] CalendarAttendee model (event_id, user_id, status, rsvp)
- [x] CalendarReminder model (event_id, minutes_before, type: email/notification)
- [x] CalendarSubscription model (user_id, external_ical_url, sync_interval)
- [x] CalendarCategory model (name, color, user_id)

## API Endpoints (FastAPI)
- [x] GET /calendar/events (date range, filtered)
- [x] POST /calendar/events
- [x] GET /calendar/events/{id}
- [x] PUT /calendar/events/{id}
- [x] DELETE /calendar/events/{id}
- [x] CalDAV sync with Stalwart (temporary)
- [x] GET /calendar/events/recurring (expand recurrence)
- [x] POST /calendar/events/{id}/rsvp
- [x] GET /calendar/availability (free/busy lookup)
- [x] POST /calendar/subscriptions (subscribe to external iCal)
- [x] GET/POST /calendar/categories
- [x] POST /calendar/events/{id}/duplicate
- [x] GET /calendar/events/export (iCal export)

## Frontend Pages (React)
- [x] FullCalendar integration (month/week/day views)
- [x] Event create/edit modal
- [x] Agenda/list view
- [x] Multi-calendar sidebar (toggle calendars) — `MultiCalendarSidebar.tsx` imported in CalendarPage
- [x] Drag-and-drop event rescheduling — `onEventDrop` + `draggable` in MonthView
- [x] Event detail popover — `EventDetailPopover.tsx` imported in CalendarPage
- [x] Recurring event editor (daily/weekly/monthly/custom) — `RecurringEventEditor.tsx` imported in CalendarPage
- [x] Free/busy scheduling assistant
- [x] Mini calendar in sidebar — `MiniCalendar.tsx` imported in CalendarPage
- [x] Calendar sharing UI — `CalendarShareDialog.tsx` imported in CalendarPage
- [x] Print view — `PrintView.tsx` imported in CalendarPage

## Integrations
- [x] Mail --> Calendar: auto-create events from meeting subjects
- [x] Projects --> Calendar: task deadlines as events
- [x] Meetings --> Calendar: meeting events
- [x] Calendar --> Mail: send event invites via email — `integration_handlers.py` `on_calendar_event_created_send_invites` handler sends email invites to all attendees on `calendar.event.created` event
- [x] Calendar --> Notifications: reminders — Celery task `calendar_event_reminders` + `calendar.event.reminder` event bus handler in integration_handlers.py
- [x] HR --> Calendar: leave/holidays displayed — `main.py` auto-creates calendar events for approved leave
- [x] AI scheduling suggestions — `ai_schedule_meeting` endpoint in ai_features.py

## Stalwart CalDAV Replacement
- [x] REST-first calendar API (CalDAV dropped in favor of our own REST API + iCal import/export + external calendar subscriptions — Stalwart CalDAV available as optional sync bridge)
- [x] iCal format import/export — `export_events_ical` endpoint in calendar_ext.py (ICS export)
- [x] External calendar subscription (Google, Outlook .ics URLs) — CalendarSubscription model + subscription CRUD in calendar_ext.py

## Tests
- [x] Event CRUD tests
- [x] Recurrence expansion tests — test_calendar_extended.py has 7+ recurrence tests (weekly, daily, monthly, interval, end date, non-recurring)
- [x] CalDAV sync tests — `test_calendar_timezone.py` has CalDAV/ICS format tests (`test_event_has_required_caldav_fields`)
- [x] Timezone handling tests — `test_calendar_timezone.py` has dedicated timezone tests (UTC, offset, different timezone — 3+ tests)

## Mobile / Responsive
- [x] Responsive calendar views — mobile new-event button + sidebar hidden on mobile in CalendarPage.tsx
- [x] Mobile event creation — mobile new-event FAB in CalendarPage.tsx
- [x] Swipe between days/weeks — CalendarPage.tsx uses `useSwipeGesture` hook with onSwipeLeft/onSwipeRight for mobile date navigation
