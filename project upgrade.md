Ready for review
Select text to add comments on the plan
Projects Module Upgrade — ClickUp + MS Project Hybrid
Context
The existing Projects module has a solid foundation (12 models, 80+ endpoints, 17 frontend files) with Kanban board, Gantt chart, time tracking, templates, and cross-module links. This upgrade brings it to ClickUp/MS Project parity with subtasks, custom fields, comments, new views, automation, and agile features. The plan is phased: MVP first, then advanced scheduling/AI/reporting later.

MVP Phase — 5 Sprints
Sprint 1: Task Model Enhancements (Foundation)
Backend — New models file: backend/app/models/projects_enhanced.py

TaskChecklist — checklist items per task (title, is_completed, order, completed_by)
TaskRelationship — custom relationships: blocks, duplicates, relates_to (source_task_id ↔ target_task_id)
ProjectCustomField — field definitions per project (name, field_type: text/number/dropdown/date/formula, options JSONB, is_required, order)
TaskCustomFieldValue — field values per task (value_text, value_number, value_date — typed columns for SQL filtering)
Sprint — agile sprints (name, goal, start_date, end_date, status: planning/active/completed)
Backend — Modify backend/app/models/projects.py (Task model)

Add parent_id (self-referential FK, CASCADE) — subtask support, cap at 3 levels
Add start_date (DateTime nullable)
Add estimated_hours (Float nullable)
Add sprint_id (FK → project_sprints, SET NULL)
Add relationships: parent, subtasks, checklists, custom_field_values
Backend — New router: backend/app/api/v1/projects_subtasks.py

Method	Path	Description
POST	/{project_id}/tasks/{task_id}/subtasks	Create subtask
GET	/{project_id}/tasks/{task_id}/subtasks	List subtasks
PUT	/{project_id}/tasks/{task_id}/reparent	Move task to different parent
POST	/{project_id}/tasks/{task_id}/checklists	Add checklist item
GET	/{project_id}/tasks/{task_id}/checklists	List checklist items
PUT	/{project_id}/tasks/{task_id}/checklists/{item_id}	Toggle/rename/reorder
DELETE	/{project_id}/tasks/{task_id}/checklists/{item_id}	Delete item
POST	/tasks/{task_id}/relationships	Create relationship
GET	/tasks/{task_id}/relationships	List relationships
DELETE	/tasks/{task_id}/relationships/{rel_id}	Remove relationship
Backend — New router: backend/app/api/v1/projects_custom_fields.py

Method	Path	Description
POST	/{project_id}/custom-fields	Define custom field
GET	/{project_id}/custom-fields	List definitions
PUT	/{project_id}/custom-fields/{field_id}	Update definition
DELETE	/{project_id}/custom-fields/{field_id}	Delete (cascades values)
PUT	/{project_id}/tasks/{task_id}/custom-fields	Batch set values
GET	/{project_id}/tasks/{task_id}/custom-fields	Get values
Alembic Migration 1 (projects_enhanced_core): All new tables + Task column additions

Sprint 2: Recurring Tasks + Audit Log + Comments
Backend — Add to projects_enhanced.py

RecurringTaskConfig — recurrence_type (daily/weekly/monthly/custom), interval, day_of_week, cron_expression, next_run_at, template_task JSONB
TaskAuditLog — immutable trail (task_id, user_id, action, changes JSONB, created_at only)
TaskComment — threaded comments (content, author_id, parent_id for replies, mentions JSONB, is_edited). Pattern: mirror backend/app/models/doc_comment.py
Backend — New router: backend/app/api/v1/projects_recurring.py

CRUD for recurring configs + manual trigger endpoint
Celery beat task in backend/app/tasks/celery_app.py — runs every 15 min, creates tasks where next_run_at <= now()
Backend — New router: backend/app/api/v1/projects_comments.py

CRUD for comments + GET /{project_id}/tasks/{task_id}/activity merged feed
Parse @[username] mentions → create Notification entries
Publish task.commented event
Backend — Modify backend/app/api/v1/projects.py

Add _record_audit() helper, call from update_task and create_task
Add GET /{project_id}/tasks/{task_id}/audit-log endpoint
Alembic Migration 2 (projects_recurring_and_audit): recurring_configs, audit_log, comments tables + Task.recurring_config_id

Frontend — New files in frontend/src/features/projects/

TaskDetailPanel.tsx — refactor TaskDetail.tsx from modal → right-side drawer with tabs (Details, Subtasks, Checklists, Comments, Activity, Custom Fields)
SubtaskList.tsx — indented subtask list with inline add
ChecklistSection.tsx — checkboxes + progress bar
TaskComments.tsx — threaded comments with @mention autocomplete
TaskActivityFeed.tsx — merged timeline of audit log + comments
CustomFieldsEditor.tsx — render inputs by field type
CustomFieldsManager.tsx — project settings: define/edit/delete custom fields
RecurringTaskConfig.tsx — recurrence schedule UI
Frontend — New API client: frontend/src/api/projects_enhanced.ts

TanStack Query hooks for all Sprint 1+2 endpoints
Extend Task interface in projects.ts: add parent_id, subtask_count, checklist_progress, comment_count, start_date, estimated_hours, sprint_id
Frontend — Modify existing

TaskCard.tsx — add subtask count badge, checklist progress bar, comment count icon
TaskDetail.tsx → replace with TaskDetailPanel.tsx
Sprint 3: New Views (List, Calendar, Backlog)
Backend — New router: backend/app/api/v1/projects_sprints.py

Method	Path	Description
POST	/{project_id}/sprints	Create sprint
GET	/{project_id}/sprints	List sprints
PUT	/{project_id}/sprints/{sprint_id}	Update sprint
DELETE	/{project_id}/sprints/{sprint_id}	Delete sprint
PUT	/{project_id}/tasks/{task_id}/sprint	Assign task to sprint
GET	/{project_id}/backlog	Tasks with sprint_id IS NULL
GET	/{project_id}/calendar	Tasks in date range, grouped by date
Backend — Enhance projects.py

GET /{project_id}/tasks — add sort_by, sort_dir, search, tag, custom_field_filter params
PUT /{project_id}/tasks/bulk — bulk update status/priority/assignee/sprint for multiple task IDs
Frontend — New pages

ListView.tsx — sortable table with inline editing, column resize, bulk selection toolbar
CalendarView.tsx — month/week calendar rendering tasks by due_date, drag to reschedule
BacklogView.tsx — sprint planning: backlog column + sprint columns, drag tasks between
SprintManager.tsx — create/edit sprints, set goals, start/complete
Frontend — New routes in App.tsx

projects/:id/list → ListView
projects/:id/calendar → CalendarView
projects/:id/backlog → BacklogView
Sprint 4: Kanban Swimlanes + Automation Engine
Backend — Add to projects_enhanced.py

AutomationRule — trigger_type (status_change/due_date_reached/assignment_change/task_created/priority_change), trigger_config JSONB, action_type (assign_user/send_notification/move_to_status/create_subtask/add_tag), action_config JSONB, is_active, execution_count
Backend — New files

backend/app/api/v1/projects_automation.py — CRUD for rules + dry-run test + templates
backend/app/services/automation_engine.py — match rules against events, execute actions
Backend — Modify backend/app/main.py

Register automation handlers for task.status_changed, task.assigned, task.created events
Alembic Migration 3 (projects_automation): automation_rules table

Frontend — New pages

AutomationBuilder.tsx — visual rule builder: trigger picker → condition config → action picker
AutomationsList.tsx — list/toggle/delete automation rules
KanbanSwimlanes.tsx — enhance ProjectBoard.tsx with swimlane grouping by assignee/priority/sprint (frontend-only grouping, no new endpoint)
Frontend — New route: projects/:id/automations → AutomationsList

Sprint 5: Guest Access + Email-to-Task + Polish
Backend — Add to projects_enhanced.py

ProjectGuestAccess — email, token, permissions JSONB, invited_by, expires_at
Backend — New router: backend/app/api/v1/projects_guests.py

Invite guest (generate token, send email via Stalwart SMTP)
List/revoke guests
Guest view endpoint (token-based, returns limited project data)
POST /webhooks/email-to-task — Stalwart inbound email webhook → auto-create task
Frontend — New components

GuestInviteDialog.tsx — invite dialog with permission toggles
Polish all views: loading states, empty states, error boundaries, mobile responsiveness
Phase 2 (Post-MVP) — Advanced Planning & AI
Lead/lag on dependencies, critical path calculation & highlighting
Baselines (set, compare, variance reporting)
Task constraints & effort estimation, duration types
Portfolio model (group projects, roll-up roadmaps)
Enterprise resource pool (skills, availability, cost rates)
Resource leveling & overallocation alerts
AI project plan generation from natural language
AI status report generation, risk detection, health score
Phase 3 (Post-MVP) — Reporting & Extensions
OKR-style Goals with progress roll-ups
Custom dashboards with drag-and-drop widgets
Earned Value Management (EVM)
Portfolio analytics (ROI, risk, status)
Exportable reports (PDF, Excel)
Mind Maps view, Whiteboards linked to tasks
Hybrid mode toggle (agile vs traditional per project)
Key Files to Modify
File	Changes
backend/app/models/projects.py	Add parent_id, start_date, estimated_hours, sprint_id, recurring_config_id to Task
backend/app/api/v1/projects.py	Add audit log calls, enhance filtering, add bulk update
backend/app/api/v1/__init__.py	Register 6 new routers
backend/app/main.py	Register automation event handlers
backend/app/tasks/celery_app.py	Add recurring task beat schedule
frontend/src/api/projects.ts	Extend Task interface
frontend/src/features/projects/TaskDetail.tsx	Refactor to tabbed panel
frontend/src/features/projects/TaskCard.tsx	Add badge indicators
frontend/src/features/projects/ProjectBoard.tsx	Add swimlane toggle
frontend/src/features/projects/BulkTaskOperations.tsx	Extend bulk actions
frontend/src/App.tsx	Add new routes
Reusable Patterns
Comment model: Mirror backend/app/models/doc_comment.py for TaskComment
Event bus: Use existing publish_event() in backend/app/core/event_bus.py
Notifications: Use existing Notification model for @mentions
Celery tasks: Follow pattern in backend/app/tasks/celery_app.py
TanStack Query hooks: Follow pattern in frontend/src/api/projects.ts and projects_ext.ts
UI components: Use existing shared components from frontend/src/shared/ui/
Verification
Backend: Run docker compose exec backend alembic upgrade head — all migrations apply cleanly
API: Test each new router via Swagger at http://localhost:8010/docs
Frontend: npm run dev — all new views render, navigation works
Integration: Create project → add subtasks → add checklists → post comment with @mention → verify notification created
Automation: Create rule (on status change → assign user) → change task status → verify assignment
Recurring: Create recurring config → wait for Celery beat → verify task created
Views: Test List/Calendar/Backlog views with real data, verify sorting/filtering/drag-and-drop