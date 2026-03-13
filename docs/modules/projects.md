# Projects Module

> Task management, Kanban boards, time tracking, sprint planning, and cross-module integrations.

## Overview

The Projects module provides collaborative project and task management with Kanban boards, list view, Gantt-style timeline, sprint planning, time tracking, and deep integration with Drive (file storage), Finance (expense tracking), CRM (deal linking), and HR (team members).

**Who uses it:** Project Managers, Team Members, all Employees
**Requires:** Authenticated user (own projects); projects.admin for all projects

---

## Features

- **Projects** — organize work into projects with goals, dates, and team members
- **Kanban boards** — drag-and-drop task management across custom stages
- **List & timeline views** — alternative views for different work styles
- **Tasks** — full task details: description, assignee, due date, priority, custom fields
- **Subtasks** — break down complex tasks into checklist items
- **Comments** — threaded comments on tasks with @mentions and file attachments
- **Custom fields** — add any field to tasks without code (text, date, number, dropdown)
- **Sprint planning** — agile sprints with velocity tracking and burndown charts
- **Time tracking** — log time against tasks; export for client billing
- **Recurring tasks** — auto-create tasks on a schedule (weekly reports, monthly reviews)
- **Automation rules** — trigger actions on task events (assign, send email, update CRM)
- **Risk analysis** — AI-powered project risk assessment
- **Integrations** — Drive folders, Finance expenses, CRM deals, Mail notifications

---

## Architecture

### Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/projects.py` | Core CRUD: projects, tasks, boards |
| `backend/app/api/v1/projects_automation.py` | Automation rules for project events |
| `backend/app/api/v1/projects_comments.py` | Task comments and @mentions |
| `backend/app/api/v1/projects_custom_fields.py` | Dynamic custom field management |
| `backend/app/api/v1/projects_integrations.py` | Cross-module link endpoints |
| `backend/app/api/v1/projects_recurring.py` | Recurring task templates |
| `backend/app/api/v1/projects_sprints.py` | Sprint management and planning |
| `backend/app/api/v1/projects_subtasks.py` | Subtask and checklist management |
| `backend/app/models/projects.py` | Projects SQLAlchemy models |
| `frontend/src/features/projects/` | Projects frontend pages |
| `frontend/src/api/projects.ts` | Projects API client hooks |

---

## Data Models

| Model | Table | Description |
|-------|-------|-------------|
| `Project` | `projects` | A project with team, goals, and timeline |
| `ProjectTask` | `project_tasks` | A task within a project |
| `TaskComment` | `project_task_comments` | Comment thread on a task |
| `Sprint` | `project_sprints` | Agile sprint within a project |
| `TimeLog` | `project_time_logs` | Time logged against a task |
| `ProjectDealLink` | `project_deal_links` | Link between project and CRM deal |
| `ProjectExpenseLink` | `project_expense_links` | Link between project and Finance expense |
| `ProjectDriveFolder` | `project_drive_folders` | Auto-created Drive folder for a project |

---

## Task Lifecycle

```
todo → in_progress → review → done
  ↓
blocked (waiting on dependency)
  ↓
cancelled
```

## Cross-Module Integrations

| Module | Integration |
|--------|-------------|
| Drive | Auto-create Drive folder when project is created; attach files to tasks |
| Finance | Link tasks to expense claims; project budget tracking |
| CRM | Link project to CRM deal (e.g., "Implementation project for Acme Corp deal") |
| Mail | Task assignment and status change email notifications |
| Calendar | Task due dates create calendar reminders |
| HR | Team members assigned from employee directory |

---

## Events Published

| Event | Trigger |
|-------|---------|
| `task.status.changed` | Task moved to different stage |
| `task.assigned` | Task assigned to a user |
