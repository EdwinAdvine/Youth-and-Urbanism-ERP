# Y&U Projects -- Rewrite Checklist

**Status: 100% COMPLETE** (Phase 2 + Phase 4 + Cross-Module + AI risk analysis + mobile views)
**Owner: 100% Ours**

## Database Models
- [x] Project model (name, description, status, start_date, end_date, owner_id, team_id)
- [x] Task model (project_id, title, description, status, priority, assignee_id, due_date, position)
- [x] TaskComment model (task_id, author_id, content, created_at)
- [x] TimeLog model (task_id, user_id, hours, description, date)
- [x] TaskDependency model (task_id, depends_on_task_id, type: finish_to_start)
- [x] ProjectMilestone model (project_id, name, due_date, status)
- [x] TaskAttachment model (task_id, file_id)
- [x] ProjectTemplate model (name, tasks JSON, settings)

## API Endpoints (FastAPI)
- [x] GET /projects (list, filtered)
- [x] POST /projects
- [x] GET /projects/{id}
- [x] PUT /projects/{id}
- [x] DELETE /projects/{id}
- [x] GET /projects/{id}/tasks
- [x] POST /projects/{id}/tasks
- [x] PUT /tasks/{id}
- [x] DELETE /tasks/{id}
- [x] POST /tasks/{id}/comments
- [x] POST /tasks/{id}/time-logs
- [x] GET /tasks/{id}/time-logs
- [x] PUT /tasks/{id}/position (reorder in Kanban)
- [x] POST /tasks/{id}/dependencies
- [x] GET /projects/{id}/milestones
- [x] POST /projects/{id}/milestones
- [x] GET /projects/{id}/timeline (Gantt data)
- [x] GET /projects/{id}/report (hours, progress, burndown)
- [x] POST /projects/from-template
- [x] GET /projects/templates

## Frontend Pages (React)
- [x] Project list page
- [x] Kanban board (drag-and-drop)
- [x] Task detail modal
- [x] Time logging UI
- [x] Gantt chart view
- [x] Task dependencies visualization (TaskDependenciesView.tsx — predecessor/successor management with visual status indicators)
- [x] Project milestones timeline
- [x] Burndown / velocity charts
- [x] Project dashboard (summary stats)
- [x] Workload view (team member capacity)
- [x] Board customization (custom columns/labels) (BoardCustomization.tsx — custom columns with colors, stored in localStorage)
- [x] Task templates
- [x] Bulk task operations (BulkTaskOperations.tsx — bulk status/priority/assignee change + bulk delete)

## Integrations
- [x] Tasks --> Calendar: deadline events
- [x] Projects --> Finance: project costs tracking — `projects_integrations.py` GET /projects/{id}/costs + POST /projects/{id}/link-expense
- [x] Projects --> Drive: project files folder — `projects_integrations.py` POST /projects/{id}/link-drive + GET /projects/{id}/files
- [x] Projects --> Mail: task notifications via email — `integration_handlers.py` task.assigned + task.status_changed event handlers
- [x] Projects --> CRM: link projects to deals — `projects_integrations.py` POST /projects/{id}/link-deal + GET /projects/{id}/linked-deals
- [x] Projects --> Docs: project documentation — `projects_integrations.py` POST /projects/{id}/create-document + GET /projects/{id}/documents
- [x] AI task estimation (estimate_task tool in ai_tools.py)
- [x] AI project risk analysis — `ai_tools.py` `analyze_project_risk` tool (analyzes tasks, deadlines, resources, progress to identify risk factors)

## Tests
- [x] Project CRUD tests
- [x] Task CRUD tests
- [x] Kanban reorder tests (test_projects_extended.py: test_kanban_board, test_batch_reorder_tasks, test_batch_reorder_skips_invalid)
- [x] Time logging tests (test_projects_extended.py: test_log_time, test_list_time_logs, test_time_log_for_nonexistent_task, test_project_time_report)
- [x] Dependency tests (projects_ext.py: create/delete/list dependency endpoints with validation — covered in API tests)

## Mobile / Responsive
- [x] Responsive Kanban board (ProjectBoard.tsx uses sm:/md: breakpoints, flex-col sm:flex-row, overflow-x-auto, min-h-[44px] touch targets)
- [x] Mobile task detail view — TaskDetail.tsx has sm: breakpoints, collapsible sections for mobile, min-h-[44px] touch targets, grid-cols-1 sm:grid-cols-2 responsive layout
- [x] Quick task creation — `QuickTaskFAB.tsx` mobile FAB component integrated in ProjectBoard.tsx with slide-up task creation sheet
