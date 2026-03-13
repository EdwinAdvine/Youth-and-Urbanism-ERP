# Calendar & Meetings — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 110


## Contents

- [calendar_ai_router.py](#calendar-ai-router) (3 endpoints)
- [calendar_analytics.py](#calendar-analytics) (4 endpoints)
- [calendar_attachments.py](#calendar-attachments) (4 endpoints)
- [calendar_automation.py](#calendar-automation) (4 endpoints)
- [calendar_ext.py](#calendar-ext) (12 endpoints)
- [calendar_focus.py](#calendar-focus) (5 endpoints)
- [calendar_group.py](#calendar-group) (9 endpoints)
- [calendar_mail_scanner.py](#calendar-mail-scanner) (3 endpoints)
- [calendar_resources.py](#calendar-resources) (8 endpoints)
- [calendar_roi.py](#calendar-roi) (4 endpoints)
- [calendar_router.py](#calendar-router) (7 endpoints)
- [calendar_scheduling.py](#calendar-scheduling) (5 endpoints)
- [calendar_task_sync.py](#calendar-task-sync) (4 endpoints)
- [calendar_webhooks.py](#calendar-webhooks) (8 endpoints)
- [meetings.py](#meetings) (9 endpoints)
- [meetings_ext.py](#meetings-ext) (21 endpoints)

---

## calendar_ai_router.py

Calendar AI endpoints — NLP event creation, scheduling suggestions, smart rescheduling.

**Base path:** `/calendar/ai`


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/calendar/ai/parse-event` | `parse_natural_language_event` | Parse free-text into a structured calendar event. |
| `POST` | `/calendar/ai/suggest-times` | `suggest_optimal_times` | Suggest top 3 optimal meeting times for the given attendees. |
| `POST` | `/calendar/ai/reschedule/{event_id}` | `suggest_reschedule` | Suggest alternative times for an event that has conflicts. |

### `POST /calendar/ai/parse-event`

**Function:** `parse_natural_language_event` (line 23)

Parse free-text into a structured calendar event.

**Parameters:** `payload`

**Auth:** `user`


### `POST /calendar/ai/suggest-times`

**Function:** `suggest_optimal_times` (line 39)

Suggest top 3 optimal meeting times for the given attendees.

**Parameters:** `payload`

**Auth:** `user`


### `POST /calendar/ai/reschedule/{event_id}`

**Function:** `suggest_reschedule` (line 57)

Suggest alternative times for an event that has conflicts.

**Parameters:** `event_id`

**Auth:** `user`


---

## calendar_analytics.py

Calendar analytics & meeting prep API.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/analytics/summary` | `calendar_analytics_summary` | Meeting trends, time breakdown, and productivity insights. |
| `GET` | `/events/{event_id}/prep` | `meeting_prep_card` | Auto-pull attendee CRM profiles, recent deals, open tickets, and invoices. |
| `POST` | `/events/from-invoice` | `create_event_from_invoice` | One-click create event linked to a Finance invoice with auto-populated context. |
| `POST` | `/events/from-ticket` | `create_event_from_ticket` | Auto-schedule customer callback from a support ticket. |

### `GET /analytics/summary`

**Function:** `calendar_analytics_summary` (line 23)

Meeting trends, time breakdown, and productivity insights.

**Parameters:** `days`

**Auth:** `current_user`


### `GET /events/{event_id}/prep`

**Function:** `meeting_prep_card` (line 131)

Auto-pull attendee CRM profiles, recent deals, open tickets, and invoices.

**Parameters:** `event_id`

**Auth:** `current_user`


### `POST /events/from-invoice`

**Function:** `create_event_from_invoice` (line 237)

One-click create event linked to a Finance invoice with auto-populated context.

**Parameters:** `invoice_id`, `title`, `start_time`

**Auth:** `current_user`


### `POST /events/from-ticket`

**Function:** `create_event_from_ticket` (line 272)

Auto-schedule customer callback from a support ticket.

**Parameters:** `ticket_id`, `start_time`

**Auth:** `current_user`


---

## calendar_attachments.py

Calendar Event Attachments — upload, list, delete, and presigned download.

**Base path:** `/calendar`


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/calendar/events/{event_id}/attachments` | `upload_attachment` | Upload a file (max 25 MB) and attach it to the given calendar event. |
| `GET` | `/calendar/events/{event_id}/attachments` | `list_attachments` | Return all file attachments belonging to the given event. |
| `DELETE` | `/calendar/events/{event_id}/attachments/{attachment_id}` | `delete_attachment` | Delete an attachment from MinIO and the database. |
| `GET` | `/calendar/events/{event_id}/attachments/{attachment_id}/download` | `download_attachment` | Return (or redirect to) a MinIO presigned URL valid for 1 hour. |

### `POST /calendar/events/{event_id}/attachments`

**Function:** `upload_attachment` (line 73)

Upload a file (max 25 MB) and attach it to the given calendar event.

The file is stored in MinIO under:
    ``calendar/attachments/{event_id}/{unique_id}_{original_filename}``

The caller must be authenticated.  Any attendee or organizer may attach files.

**Parameters:** `event_id`, `file`

**Response model:** `AttachmentOut`

**Auth:** `current_user`


### `GET /calendar/events/{event_id}/attachments`

**Function:** `list_attachments` (line 167)

Return all file attachments belonging to the given event.

**Parameters:** `event_id`

**Auth:** `current_user`


### `DELETE /calendar/events/{event_id}/attachments/{attachment_id}`

**Function:** `delete_attachment` (line 189)

Delete an attachment from MinIO and the database.

Only the uploader of the attachment **or** the organizer of the event may
perform this action.

**Parameters:** `event_id`, `attachment_id`

**Auth:** `current_user`


### `GET /calendar/events/{event_id}/attachments/{attachment_id}/download`

**Function:** `download_attachment` (line 244)

Return (or redirect to) a MinIO presigned URL valid for 1 hour.

Query param ``redirect=true`` sends an HTTP 302 redirect directly to the
presigned URL.  Default behaviour returns JSON ``{"url": "..."}``.

**Parameters:** `event_id`, `attachment_id`, `redirect`

**Auth:** `current_user`


---

## calendar_automation.py

Calendar automation rules — CRUD endpoints for auto-accept/decline/schedule rules.

**Base path:** `/calendar/automation`


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/calendar/automation/rules` | `list_rules` | — |
| `POST` | `/calendar/automation/rules` | `create_rule` | — |
| `PUT` | `/calendar/automation/rules/{rule_id}` | `update_rule` | — |
| `DELETE` | `/calendar/automation/rules/{rule_id}` | `delete_rule` | — |

### `GET /calendar/automation/rules`

**Function:** `list_rules` (line 48)

**Auth:** `user`


### `POST /calendar/automation/rules`

**Function:** `create_rule` (line 72)

**Parameters:** `payload`

**Auth:** `user`


### `PUT /calendar/automation/rules/{rule_id}`

**Function:** `update_rule` (line 97)

**Parameters:** `rule_id`, `payload`

**Auth:** `user`


### `DELETE /calendar/automation/rules/{rule_id}`

**Function:** `delete_rule` (line 119)

**Parameters:** `rule_id`

**Auth:** `user`


---

## calendar_ext.py

Calendar Extensions API — Recurring expansion, RSVP, Availability, Subscriptions, Categories, Utilities.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/events/recurring` | `list_recurring_events` | Expand recurrence rules into individual event instances for the given range. |
| `POST` | `/events/{event_id}/rsvp` | `rsvp_event` | — |
| `GET` | `/availability` | `check_availability` | — |
| `GET` | `/subscriptions` | `list_subscriptions` | — |
| `POST` | `/subscriptions` | `create_subscription` | — |
| `DELETE` | `/subscriptions/{sub_id}` | `delete_subscription` | — |
| `GET` | `/categories` | `list_categories` | — |
| `POST` | `/categories` | `create_category` | — |
| `PUT` | `/categories/{cat_id}` | `update_category` | — |
| `DELETE` | `/categories/{cat_id}` | `delete_category` | — |
| `POST` | `/events/{event_id}/duplicate` | `duplicate_event` | — |
| `GET` | `/events/export` | `export_events_ical` | Export user's calendar events in iCalendar (ICS) format. |

### `GET /events/recurring`

**Function:** `list_recurring_events` (line 96)

Expand recurrence rules into individual event instances for the given range.

**Parameters:** `start`, `end`

**Auth:** `current_user`


### `POST /events/{event_id}/rsvp`

**Function:** `rsvp_event` (line 188)

**Parameters:** `event_id`, `payload`

**Auth:** `current_user`


### `GET /availability`

**Function:** `check_availability` (line 254)

**Parameters:** `user_ids`, `start`, `end`

**Auth:** `current_user`


### `GET /subscriptions`

**Function:** `list_subscriptions` (line 295)

**Auth:** `current_user`


### `POST /subscriptions`

**Function:** `create_subscription` (line 316)

**Parameters:** `payload`

**Auth:** `current_user`


### `DELETE /subscriptions/{sub_id}`

**Function:** `delete_subscription` (line 338)

**Parameters:** `sub_id`

**Auth:** `current_user`


### `GET /categories`

**Function:** `list_categories` (line 354)

**Auth:** `current_user`


### `POST /categories`

**Function:** `create_category` (line 375)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /categories/{cat_id}`

**Function:** `update_category` (line 392)

**Parameters:** `cat_id`, `payload`

**Auth:** `current_user`


### `DELETE /categories/{cat_id}`

**Function:** `delete_category` (line 415)

**Parameters:** `cat_id`

**Auth:** `current_user`


### `POST /events/{event_id}/duplicate`

**Function:** `duplicate_event` (line 431)

**Parameters:** `event_id`, `offset_days`

**Auth:** `current_user`


### `GET /events/export`

**Function:** `export_events_ical` (line 461)

Export user's calendar events in iCalendar (ICS) format.

**Parameters:** `start`, `end`

**Auth:** `current_user`


---

## calendar_focus.py

Calendar Focus Time management API.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/focus-time` | `list_focus_time_blocks` | Return all focus-time blocks belonging to the authenticated user. |
| `POST` | `/focus-time` | `create_focus_time_block` | Create a new focus-time block for the authenticated user. |
| `PUT` | `/focus-time/{block_id}` | `update_focus_time_block` | Partially update a focus-time block owned by the authenticated user. |
| `DELETE` | `/focus-time/{block_id}` | `delete_focus_time_block` | Delete a focus-time block owned by the authenticated user. |
| `GET` | `/focus-time/active` | `get_active_focus_blocks` | Return focus-time blocks that are active right now. |

### `GET /focus-time`

**Function:** `list_focus_time_blocks` (line 117)

Return all focus-time blocks belonging to the authenticated user.

**Auth:** `current_user`


### `POST /focus-time`

**Function:** `create_focus_time_block` (line 136)

Create a new focus-time block for the authenticated user.

**Parameters:** `payload`

**Response model:** `FocusTimeBlockOut`

**Auth:** `current_user`


### `PUT /focus-time/{block_id}`

**Function:** `update_focus_time_block` (line 170)

Partially update a focus-time block owned by the authenticated user.

**Parameters:** `block_id`, `payload`

**Response model:** `FocusTimeBlockOut`

**Auth:** `current_user`


### `DELETE /focus-time/{block_id}`

**Function:** `delete_focus_time_block` (line 211)

Delete a focus-time block owned by the authenticated user.

**Parameters:** `block_id`

**Auth:** `current_user`


### `GET /focus-time/active`

**Function:** `get_active_focus_blocks` (line 227)

Return focus-time blocks that are active right now.

Checks the current server time's day-of-week and hour/minute against
stored blocks. Used by the auto-decline logic to decide whether to
reject incoming meeting invites.

**Auth:** `current_user`


---

## calendar_group.py

Calendar Group/Department calendars — auto-create from HR departments.

**Base path:** `/calendar`


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/calendar/group-calendars` | `list_group_calendars` | List all group/department/team calendars the user can see. |
| `POST` | `/calendar/group-calendars` | `create_group_calendar` | Manually create a group/team calendar. |
| `POST` | `/calendar/group-calendars/sync-departments` | `sync_department_calendars` | Auto-create a department calendar for every HR department. |
| `DELETE` | `/calendar/group-calendars/{calendar_id}` | `delete_group_calendar` | Delete a group calendar. Only owner or super admin can delete. |
| `GET` | `/calendar/group-calendars/{calendar_id}/members` | `list_calendar_members` | List all members with their permission levels. |
| `GET` | `/calendar/permissions` | `list_calendar_permissions` | List CalendarPermission records. |
| `POST` | `/calendar/permissions` | `create_calendar_permission` | Grant a user access to a calendar. |
| `PUT` | `/calendar/permissions/{permission_id}` | `update_calendar_permission` | Update a CalendarPermission's level. |
| `DELETE` | `/calendar/permissions/{permission_id}` | `delete_calendar_permission` | Revoke a CalendarPermission. |

### `GET /calendar/group-calendars`

**Function:** `list_group_calendars` (line 56)

List all group/department/team calendars the user can see.

**Parameters:** `calendar_type`

**Auth:** `user`


### `POST /calendar/group-calendars`

**Function:** `create_group_calendar` (line 95)

Manually create a group/team calendar.

**Parameters:** `body`

**Response model:** `GroupCalendarOut`

**Auth:** `user`


### `POST /calendar/group-calendars/sync-departments`

**Function:** `sync_department_calendars` (line 142)

Auto-create a department calendar for every HR department.

- Creates UserCalendar with type='department' linked to the department
- Grants 'read' permission to all department members
- Grants 'manage' permission to department head
- Skips departments that already have a calendar
- Rotates through a colour palette

**Response model:** `SyncResult`

**Auth:** `admin`


### `DELETE /calendar/group-calendars/{calendar_id}`

**Function:** `delete_group_calendar` (line 248)

Delete a group calendar. Only owner or super admin can delete.

**Parameters:** `calendar_id`

**Auth:** `user`


### `GET /calendar/group-calendars/{calendar_id}/members`

**Function:** `list_calendar_members` (line 269)

List all members with their permission levels.

**Parameters:** `calendar_id`

**Auth:** `user`


### `GET /calendar/permissions`

**Function:** `list_calendar_permissions` (line 321)

List CalendarPermission records.

If ``calendar_id`` is provided, returns only permissions for that calendar.
Otherwise returns all permissions on calendars owned by the current user.

**Parameters:** `calendar_id`

**Auth:** `user`


### `POST /calendar/permissions`

**Function:** `create_calendar_permission` (line 366)

Grant a user access to a calendar.

The caller must own the calendar or already have 'manage' permission.
``permission_level`` must be one of: free_busy | read | propose | edit | manage

**Parameters:** `body`

**Response model:** `PermissionOut`

**Auth:** `user`


### `PUT /calendar/permissions/{permission_id}`

**Function:** `update_calendar_permission` (line 446)

Update a CalendarPermission's level.

**Parameters:** `permission_id`, `body`

**Response model:** `PermissionOut`

**Auth:** `user`


### `DELETE /calendar/permissions/{permission_id}`

**Function:** `delete_calendar_permission` (line 497)

Revoke a CalendarPermission.

**Parameters:** `permission_id`

**Auth:** `user`


---

## calendar_mail_scanner.py

Calendar – Mail Scanner API.

Exposes three endpoints that let the frontend trigger or retrieve Era Mail
scheduling-intent scans and turn accepted suggestions into real calendar events.

Routes
------
POST /calendar/scan-mail/{message_id}
    Scan a single mail message for scheduling intent.

GET /calendar/mail-suggestions
    Return all pending calendar suggestions produced by the batch scan for
    the current user.

POST /calendar/mail-suggestions/{suggestion_id}/accept
    Accept a suggestion and materialise it as a CalendarEvent.

**Base path:** `/calendar`


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/calendar/scan-mail/{message_id}` | `scan_single_mail` | — |
| `GET` | `/calendar/mail-suggestions` | `list_mail_suggestions` | — |
| `POST` | `/calendar/mail-suggestions/{suggestion_id}/accept` | `accept_mail_suggestion` | — |

### `POST /calendar/scan-mail/{message_id}`

**Function:** `scan_single_mail` (line 145)

**Parameters:** `message_id`

**Response model:** `MailScanResult`

**Auth:** `current_user`


### `GET /calendar/mail-suggestions`

**Function:** `list_mail_suggestions` (line 213)

**Parameters:** `scan`, `hours`

**Auth:** `current_user`


### `POST /calendar/mail-suggestions/{suggestion_id}/accept`

**Function:** `accept_mail_suggestion` (line 307)

**Parameters:** `suggestion_id`, `payload`

**Response model:** `AcceptSuggestionResult`

**Auth:** `current_user`


---

## calendar_resources.py

Calendar resource booking API — rooms, equipment, vehicles.

**Base path:** `/calendar`


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/calendar/resources` | `list_resources` | — |
| `POST` | `/calendar/resources` | `create_resource` | — |
| `PUT` | `/calendar/resources/{resource_id}` | `update_resource` | — |
| `DELETE` | `/calendar/resources/{resource_id}` | `delete_resource` | — |
| `GET` | `/calendar/resources/{resource_id}/availability` | `get_resource_availability` | — |
| `POST` | `/calendar/resources/{resource_id}/book` | `book_resource` | — |
| `GET` | `/calendar/resources/bookings` | `list_my_resource_bookings` | — |
| `DELETE` | `/calendar/resources/bookings/{booking_id}` | `cancel_resource_booking` | — |

### `GET /calendar/resources`

**Function:** `list_resources` (line 102)

**Parameters:** `resource_type`, `active_only`

**Auth:** `current_user`


### `POST /calendar/resources`

**Function:** `create_resource` (line 128)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /calendar/resources/{resource_id}`

**Function:** `update_resource` (line 166)

**Parameters:** `resource_id`, `payload`

**Auth:** `current_user`


### `DELETE /calendar/resources/{resource_id}`

**Function:** `delete_resource` (line 203)

**Parameters:** `resource_id`

**Auth:** `current_user`


### `GET /calendar/resources/{resource_id}/availability`

**Function:** `get_resource_availability` (line 232)

**Parameters:** `resource_id`, `start_date`, `end_date`

**Auth:** `current_user`


### `POST /calendar/resources/{resource_id}/book`

**Function:** `book_resource` (line 324)

**Parameters:** `resource_id`, `payload`

**Auth:** `current_user`


### `GET /calendar/resources/bookings`

**Function:** `list_my_resource_bookings` (line 403)

**Parameters:** `status_filter`, `upcoming_only`

**Auth:** `current_user`


### `DELETE /calendar/resources/bookings/{booking_id}`

**Function:** `cancel_resource_booking` (line 432)

**Parameters:** `booking_id`

**Auth:** `current_user`


---

## calendar_roi.py

Calendar ROI & AI Meeting Coach endpoints.

**Base path:** `/calendar`


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/calendar/events/{event_id}/roi` | `get_meeting_roi` | Return cost breakdown, attributed revenue, and ROI % for one meeting. |
| `GET` | `/calendar/roi-dashboard` | `meeting_roi_dashboard` | Aggregate meeting costs, client vs internal split, and top 5 most expensive |
| `POST` | `/calendar/events/{event_id}/analyze-sentiment` | `analyze_event_sentiment` | Send meeting notes through the local Ollama model and receive: |
| `GET` | `/calendar/meeting-coach` | `meeting_coach_report` | Analyse the last 10 meetings with notes via Ollama. |

### `GET /calendar/events/{event_id}/roi`

**Function:** `get_meeting_roi` (line 33)

Return cost breakdown, attributed revenue, and ROI % for one meeting.

Salary data is pulled from HR employee records (monthly → hourly via /160).
Revenue attribution uses invoices paid in the last 90 days where the event
has a client_id or deal_id in erp_context.

**Parameters:** `event_id`

**Auth:** `current_user`


### `GET /calendar/roi-dashboard`

**Function:** `meeting_roi_dashboard` (line 56)

Aggregate meeting costs, client vs internal split, and top 5 most expensive
meetings for the authenticated user over the requested period.

**Parameters:** `days`

**Auth:** `current_user`


### `POST /calendar/events/{event_id}/analyze-sentiment`

**Function:** `analyze_event_sentiment` (line 75)

Send meeting notes through the local Ollama model and receive:
sentiment (positive/neutral/negative), a 0-1 score, key themes,
extracted action items, and a coaching tip.

**Parameters:** `event_id`, `body`

**Auth:** `current_user`


### `GET /calendar/meeting-coach`

**Function:** `meeting_coach_report` (line 94)

Analyse the last 10 meetings with notes via Ollama.

Returns:
- Overall sentiment trend (positive / neutral / negative)
- Client alerts — relationships showing 3+ consecutive negative scores
- Aggregated coaching tips
- Pending action items extracted from all analysed meetings

**Auth:** `current_user`


---

## calendar_router.py

Calendar API — CRUD for calendar events.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/events` | `list_events` | — |
| `POST` | `/events` | `create_event` | — |
| `PUT` | `/events/{event_id}` | `update_event` | — |
| `DELETE` | `/events/{event_id}` | `delete_event` | — |
| `GET` | `/events/{event_id}/audit-log` | `get_event_audit_log` | Return all CalendarAuditLog entries for an event, newest first. |
| `POST` | `/sync` | `sync_calendar` | CalDAV sync has been retired. The calendar now uses the REST API directly. |
| `POST` | `/events/{event_id}/expand` | `expand_recurring_event` | Generate individual event instances from a recurring event's RRULE. |

### `GET /events`

**Function:** `list_events` (line 113)

**Parameters:** `start`, `end`, `event_type`

**Auth:** `current_user`


### `POST /events`

**Function:** `create_event` (line 140)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /events/{event_id}`

**Function:** `update_event` (line 215)

**Parameters:** `event_id`, `payload`

**Auth:** `current_user`


### `DELETE /events/{event_id}`

**Function:** `delete_event` (line 276)

**Parameters:** `event_id`

**Auth:** `current_user`


### `GET /events/{event_id}/audit-log`

**Function:** `get_event_audit_log` (line 307)

Return all CalendarAuditLog entries for an event, newest first.

Only the event organizer or a user who has been granted ``manage``-level
permission on the calendar that contains the event may access this endpoint.

**Parameters:** `event_id`

**Auth:** `current_user`


### `POST /sync`

**Function:** `sync_calendar` (line 364)

CalDAV sync has been retired. The calendar now uses the REST API directly.

**Auth:** `current_user`


### `POST /events/{event_id}/expand`

**Function:** `expand_recurring_event` (line 377)

Generate individual event instances from a recurring event's RRULE.

**Parameters:** `event_id`, `count`

**Auth:** `current_user`


---

## calendar_scheduling.py

Calendar Scheduling Intelligence endpoints.

Exposes:
1.  POST /calendar/negotiate-availability  — priority-aware slot negotiation
2.  POST /calendar/travel-buffers/{event_date}  — auto travel-buffer insertion
3.  GET  /calendar/predict-conflicts  — next-week conflict + overload prediction
4.  GET  /calendar/proactive-suggestions  — unblocked tasks + approaching SLAs
5.  POST /calendar/events/{event_id}/displace  — move a lower-priority event

**Base path:** `/calendar`


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/calendar/negotiate-availability` | `negotiate_availability` | Find optimal meeting slots with priority-negotiation support. |
| `POST` | `/calendar/travel-buffers/{event_date}` | `add_travel_buffers` | Auto-insert travel-time buffers between in-person events on a given date. |
| `GET` | `/calendar/predict-conflicts` | `predict_conflicts` | Scan the next 7 days for conflicts, overloaded days, and focus violations. |
| `GET` | `/calendar/proactive-suggestions` | `proactive_suggestions` | Surface proactive scheduling recommendations. |
| `POST` | `/calendar/events/{event_id}/displace` | `displace_event` | Move an existing lower-priority event to a new time slot. |

### `POST /calendar/negotiate-availability`

**Function:** `negotiate_availability` (line 47)

Find optimal meeting slots with priority-negotiation support.

High/urgent priority requests can displace lower-priority events.
Returns up to 5 ranked slots; *negotiable* slots identify which
existing events would need to be moved.

**Parameters:** `payload`

**Auth:** `user`


### `POST /calendar/travel-buffers/{event_date}`

**Function:** `add_travel_buffers` (line 84)

Auto-insert travel-time buffers between in-person events on a given date.

``event_date`` must be an ISO-8601 date string (YYYY-MM-DD).
Returns a list of warnings for each buffer that was adjusted.

**Parameters:** `event_date`

**Auth:** `user`


### `GET /calendar/predict-conflicts`

**Function:** `predict_conflicts` (line 108)

Scan the next 7 days for conflicts, overloaded days, and focus violations.

Returns:
- **conflicts** — pairs of overlapping events (including buffer times)
- **overloaded_days** — days with > 6 hours of scheduled meetings
- **focus_violations** — events that intrude on focus-time blocks
- **suggestions** — actionable reschedule / load-reduction tips

**Auth:** `user`


### `GET /calendar/proactive-suggestions`

**Function:** `proactive_suggestions` (line 129)

Surface proactive scheduling recommendations.

Checks for:
- Tasks due within 3 days that have no calendar time-block
- Open support tickets with SLA expiring within 24 hours

Returns suggested actions the user should take.

**Auth:** `user`


### `POST /calendar/events/{event_id}/displace`

**Function:** `displace_event` (line 150)

Move an existing lower-priority event to a new time slot.

Used after ``negotiate-availability`` identifies a negotiable conflict.
The caller provides the ``new_slot_start`` (ISO-8601).  The event's
duration is preserved; only start_time and end_time are updated.

Only the event organiser (or a super admin) may displace an event.

**Parameters:** `event_id`, `payload`

**Auth:** `user`


---

## calendar_task_sync.py

Calendar – Task Sync endpoints.

Provides REST endpoints for automatic time-blocking from project tasks and
two-way task ↔ calendar sync.

Routes
------
POST   /calendar/auto-block/{task_id}       — schedule a single task time block
POST   /calendar/auto-block-batch           — schedule time blocks for multiple tasks
GET    /calendar/task-links                 — list all task-linked events for the current user
PUT    /calendar/task-links/{event_id}/sync — manually trigger calendar → task sync

**Base path:** `/calendar`


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/calendar/auto-block/{task_id}` | `auto_block_task` | Find the optimal free slot in the assignee's calendar and create a |
| `POST` | `/calendar/auto-block-batch` | `auto_block_tasks_batch` | Schedule time blocks for a list of task IDs in a single request. |
| `GET` | `/calendar/task-links` | `list_task_linked_events` | Return every CalendarEvent that is linked to a project task and is |
| `PUT` | `/calendar/task-links/{event_id}/sync` | `manual_sync_event_to_task` | Re-run the calendar→task sync for *event_id*. |

### `POST /calendar/auto-block/{task_id}`

**Function:** `auto_block_task` (line 95)

Find the optimal free slot in the assignee's calendar and create a
time-block CalendarEvent linked to the given task.

- Respects existing calendar events (no double-booking).
- Respects user focus-time blocks.
- Prefers morning slots for high-priority tasks.
- Is idempotent: if a block already exists it is returned as-is.

Returns the created (or existing) CalendarEvent details.

**Parameters:** `task_id`

**Response model:** `AutoBlockResponse`

**Auth:** `current_user`


### `POST /calendar/auto-block-batch`

**Function:** `auto_block_tasks_batch` (line 141)

Schedule time blocks for a list of task IDs in a single request.

Each task is processed independently — a failure on one task does not
abort the others.  The response contains a per-task result including
``event_id`` on success or ``error`` on failure.

Accepts up to 50 task IDs per request.

**Parameters:** `body`

**Auth:** `current_user`


### `GET /calendar/task-links`

**Function:** `list_task_linked_events` (line 176)

Return every CalendarEvent that is linked to a project task and is
organised by or attended by the current user.

Events are returned in ascending order of start_time.

**Auth:** `current_user`


### `PUT /calendar/task-links/{event_id}/sync`

**Function:** `manual_sync_event_to_task` (line 230)

Re-run the calendar→task sync for *event_id*.

Use this when you have manually rescheduled a task-linked calendar event
and want the linked task's ``due_date`` to be updated immediately without
waiting for the event-bus handler.

Returns the updated task's new due_date.

**Parameters:** `event_id`

**Response model:** `SyncResult`

**Auth:** `current_user`


---

## calendar_webhooks.py

Calendar Webhooks & API Keys router.

Endpoints:
  Webhooks
    GET    /calendar/webhooks                       — list user's webhooks
    POST   /calendar/webhooks                       — create webhook (secret shown once)
    PUT    /calendar/webhooks/{webhook_id}           — update webhook
    DELETE /calendar/webhooks/{webhook_id}           — delete webhook
    POST   /calendar/webhooks/{webhook_id}/test      — send test ping

  API Keys
    GET    /calendar/api-keys                       — list keys (prefix only, no raw key)
    POST   /calendar/api-keys                       — create key (raw key shown once)
    DELETE /calendar/api-keys/{key_id}              — revoke key

**Base path:** `/calendar`


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/calendar/webhooks` | `list_webhooks` | List all webhooks belonging to the current user. |
| `POST` | `/calendar/webhooks` | `create_webhook` | Create a new webhook subscription. |
| `PUT` | `/calendar/webhooks/{webhook_id}` | `update_webhook` | Update a webhook's name, URL, event subscriptions, or active state. |
| `DELETE` | `/calendar/webhooks/{webhook_id}` | `delete_webhook` | Permanently delete a webhook subscription. |
| `POST` | `/calendar/webhooks/{webhook_id}/test` | `test_webhook` | Send a test ping payload to the webhook URL. |
| `GET` | `/calendar/api-keys` | `list_api_keys` | List all API keys for the current user (prefix only — no raw key). |
| `POST` | `/calendar/api-keys` | `create_api_key` | Generate a new calendar API key. |
| `DELETE` | `/calendar/api-keys/{key_id}` | `revoke_api_key` | Revoke (permanently delete) a calendar API key. |

### `GET /calendar/webhooks`

**Function:** `list_webhooks` (line 193)

List all webhooks belonging to the current user.

**Auth:** `current_user`


### `POST /calendar/webhooks`

**Function:** `create_webhook` (line 207)

Create a new webhook subscription.

The plain-text secret is returned **once** in this response.  Store it
securely — it will never be returned again.

**Parameters:** `body`

**Response model:** `WebhookCreateOut`

**Auth:** `current_user`


### `PUT /calendar/webhooks/{webhook_id}`

**Function:** `update_webhook` (line 241)

Update a webhook's name, URL, event subscriptions, or active state.

**Parameters:** `webhook_id`, `body`

**Response model:** `WebhookOut`

**Auth:** `current_user`


### `DELETE /calendar/webhooks/{webhook_id}`

**Function:** `delete_webhook` (line 269)

Permanently delete a webhook subscription.

**Parameters:** `webhook_id`

**Auth:** `current_user`


### `POST /calendar/webhooks/{webhook_id}/test`

**Function:** `test_webhook` (line 281)

Send a test ping payload to the webhook URL.

Uses the same signing mechanism as real deliveries so you can verify
your endpoint's signature validation logic.

**Parameters:** `webhook_id`

**Response model:** `TestWebhookOut`

**Auth:** `current_user`


### `GET /calendar/api-keys`

**Function:** `list_api_keys` (line 352)

List all API keys for the current user (prefix only — no raw key).

**Auth:** `current_user`


### `POST /calendar/api-keys`

**Function:** `create_api_key` (line 366)

Generate a new calendar API key.

The full raw key is returned **once** in this response.  It cannot be
recovered later — copy it to a secure location now.

**Parameters:** `body`

**Response model:** `ApiKeyCreateOut`

**Auth:** `current_user`


### `DELETE /calendar/api-keys/{key_id}`

**Function:** `revoke_api_key` (line 404)

Revoke (permanently delete) a calendar API key.

**Parameters:** `key_id`

**Auth:** `current_user`


---

## meetings.py

Meetings API — calendar events with an associated Jitsi room.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `list_meetings` | — |
| `POST` | `` | `create_meeting` | — |
| `GET` | `/{meeting_id}` | `get_meeting` | — |
| `DELETE` | `/{meeting_id}` | `delete_meeting` | — |
| `GET` | `/{meeting_id}/join` | `join_meeting` | — |
| `GET` | `/virtual-backgrounds` | `list_virtual_backgrounds` | Return built-in solid-color/blur backgrounds plus any custom images uploaded ... |
| `POST` | `/virtual-backgrounds` | `upload_virtual_background` | Upload a custom image as a virtual background to MinIO. |
| `POST` | `/{meeting_id}/dial-in` | `get_dial_in` | Generate SIP dial-in details for a meeting if SIP is configured. |
| `POST` | `/recording-webhook` | `recording_webhook` | Handle Jitsi Jibri recording completion webhook. |

### `GET `

**Function:** `list_meetings` (line 67)

**Auth:** `current_user`


### `POST `

**Function:** `create_meeting` (line 87)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /{meeting_id}`

**Function:** `get_meeting` (line 182)

**Parameters:** `meeting_id`

**Auth:** `current_user`


### `DELETE /{meeting_id}`

**Function:** `delete_meeting` (line 198)

**Parameters:** `meeting_id`

**Auth:** `current_user`


### `GET /{meeting_id}/join`

**Function:** `join_meeting` (line 221)

**Parameters:** `meeting_id`

**Auth:** `current_user`


### `GET /virtual-backgrounds`

**Function:** `list_virtual_backgrounds` (line 282)

Return built-in solid-color/blur backgrounds plus any custom images uploaded to MinIO.

**Auth:** `current_user`


### `POST /virtual-backgrounds`

**Function:** `upload_virtual_background` (line 307)

Upload a custom image as a virtual background to MinIO.

**Parameters:** `file`

**Auth:** `current_user`


### `POST /{meeting_id}/dial-in`

**Function:** `get_dial_in` (line 355)

Generate SIP dial-in details for a meeting if SIP is configured.

**Parameters:** `meeting_id`

**Auth:** `current_user`


### `POST /recording-webhook`

**Function:** `recording_webhook` (line 421)

Handle Jitsi Jibri recording completion webhook.

When Jitsi finishes recording a meeting, it POSTs metadata here.
We download the recording and upload it to MinIO under meetings/ folder.

**Parameters:** `request`


---

## meetings_ext.py

Meetings Extensions API — Invite, RSVP, Recordings, Start/End, Chat, AI, Upcoming, Instant, Recurring, Templates, Cross-Module Links.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/{meeting_id}/invite` | `invite_users` | — |
| `PUT` | `/{meeting_id}/attendees/{user_id}/respond` | `rsvp_meeting` | — |
| `GET` | `/{meeting_id}/recording` | `get_recording` | — |
| `POST` | `/{meeting_id}/start` | `start_meeting` | — |
| `POST` | `/{meeting_id}/end` | `end_meeting` | — |
| `GET` | `/{meeting_id}/chat-export` | `export_chat` | — |
| `POST` | `/{meeting_id}/ai-summarize` | `ai_summarize_meeting` | — |
| `GET` | `/upcoming` | `list_upcoming` | — |
| `POST` | `/instant` | `create_instant_meeting` | — |
| `GET` | `/recurring` | `list_recurring_meetings` | — |
| `GET` | `/templates` | `list_templates` | — |
| `POST` | `/templates` | `create_template` | — |
| `POST` | `/{meeting_id}/link-task` | `link_task` | — |
| `GET` | `/{meeting_id}/linked-tasks` | `get_linked_tasks` | — |
| `DELETE` | `/{meeting_id}/unlink-task/{task_id}` | `unlink_task` | — |
| `POST` | `/{meeting_id}/create-note` | `create_meeting_note` | — |
| `GET` | `/{meeting_id}/meeting-notes` | `get_meeting_notes` | — |
| `POST` | `/{meeting_id}/link-contact` | `link_contact` | — |
| `POST` | `/{meeting_id}/link-deal` | `link_deal` | — |
| `GET` | `/{meeting_id}/linked-crm` | `get_linked_crm` | — |
| `DELETE` | `/{meeting_id}/unlink-crm/{link_type}/{entity_id}` | `unlink_crm` | — |

### `POST /{meeting_id}/invite`

**Function:** `invite_users` (line 132)

**Parameters:** `meeting_id`, `payload`

**Auth:** `current_user`


### `PUT /{meeting_id}/attendees/{user_id}/respond`

**Function:** `rsvp_meeting` (line 219)

**Parameters:** `meeting_id`, `user_id`, `payload`

**Auth:** `current_user`


### `GET /{meeting_id}/recording`

**Function:** `get_recording` (line 278)

**Parameters:** `meeting_id`

**Auth:** `current_user`


### `POST /{meeting_id}/start`

**Function:** `start_meeting` (line 320)

**Parameters:** `meeting_id`

**Auth:** `current_user`


### `POST /{meeting_id}/end`

**Function:** `end_meeting` (line 346)

**Parameters:** `meeting_id`

**Auth:** `current_user`


### `GET /{meeting_id}/chat-export`

**Function:** `export_chat` (line 379)

**Parameters:** `meeting_id`

**Auth:** `current_user`


### `POST /{meeting_id}/ai-summarize`

**Function:** `ai_summarize_meeting` (line 412)

**Parameters:** `meeting_id`, `payload`

**Auth:** `current_user`


### `GET /upcoming`

**Function:** `list_upcoming` (line 482)

**Parameters:** `days`, `limit`

**Auth:** `current_user`


### `POST /instant`

**Function:** `create_instant_meeting` (line 516)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /recurring`

**Function:** `list_recurring_meetings` (line 572)

**Auth:** `current_user`


### `GET /templates`

**Function:** `list_templates` (line 593)

**Auth:** `current_user`


### `POST /templates`

**Function:** `create_template` (line 612)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /{meeting_id}/link-task`

**Function:** `link_task` (line 681)

**Parameters:** `meeting_id`, `payload`

**Auth:** `current_user`


### `GET /{meeting_id}/linked-tasks`

**Function:** `get_linked_tasks` (line 723)

**Parameters:** `meeting_id`

**Auth:** `current_user`


### `DELETE /{meeting_id}/unlink-task/{task_id}`

**Function:** `unlink_task` (line 765)

**Parameters:** `meeting_id`, `task_id`

**Auth:** `current_user`


### `POST /{meeting_id}/create-note`

**Function:** `create_meeting_note` (line 794)

**Parameters:** `meeting_id`, `payload`

**Auth:** `current_user`


### `GET /{meeting_id}/meeting-notes`

**Function:** `get_meeting_notes` (line 860)

**Parameters:** `meeting_id`

**Auth:** `current_user`


### `POST /{meeting_id}/link-contact`

**Function:** `link_contact` (line 898)

**Parameters:** `meeting_id`, `payload`

**Auth:** `current_user`


### `POST /{meeting_id}/link-deal`

**Function:** `link_deal` (line 947)

**Parameters:** `meeting_id`, `payload`

**Auth:** `current_user`


### `GET /{meeting_id}/linked-crm`

**Function:** `get_linked_crm` (line 989)

**Parameters:** `meeting_id`

**Auth:** `current_user`


### `DELETE /{meeting_id}/unlink-crm/{link_type}/{entity_id}`

**Function:** `unlink_crm` (line 1048)

**Parameters:** `meeting_id`, `link_type`, `entity_id`

**Auth:** `current_user`

