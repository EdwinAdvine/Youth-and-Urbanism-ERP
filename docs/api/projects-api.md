# Projects — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 85


## Contents

- [projects.py](#projects) (16 endpoints)
- [projects_automation.py](#projects-automation) (5 endpoints)
- [projects_comments.py](#projects-comments) (5 endpoints)
- [projects_custom_fields.py](#projects-custom-fields) (6 endpoints)
- [projects_email_inbound.py](#projects-email-inbound) (2 endpoints)
- [projects_ext.py](#projects-ext) (13 endpoints)
- [projects_guests.py](#projects-guests) (4 endpoints)
- [projects_integrations.py](#projects-integrations) (10 endpoints)
- [projects_recurring.py](#projects-recurring) (5 endpoints)
- [projects_sprints.py](#projects-sprints) (8 endpoints)
- [projects_subtasks.py](#projects-subtasks) (11 endpoints)

---

## projects.py

Projects API — CRUD for projects, tasks, milestones, and time logs.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `list_projects` | — |
| `POST` | `` | `create_project` | — |
| `GET` | `/{project_id}` | `get_project` | — |
| `PUT` | `/{project_id}` | `update_project` | — |
| `DELETE` | `/{project_id}` | `delete_project` | — |
| `GET` | `/{project_id}/tasks` | `list_tasks` | — |
| `POST` | `/{project_id}/tasks` | `create_task` | — |
| `PUT` | `/{project_id}/tasks/{task_id}` | `update_task` | — |
| `DELETE` | `/{project_id}/tasks/{task_id}` | `delete_task` | — |
| `GET` | `/{project_id}/board` | `get_board` | — |
| `PUT` | `/{project_id}/board/reorder` | `batch_reorder_tasks` | — |
| `POST` | `/{project_id}/tasks/{task_id}/time-logs` | `create_time_log` | — |
| `GET` | `/{project_id}/tasks/{task_id}/time-logs` | `list_task_time_logs` | — |
| `GET` | `/{project_id}/time-report` | `project_time_report` | — |
| `GET` | `/{project_id}/milestones` | `list_milestones` | — |
| `POST` | `/{project_id}/milestones` | `create_milestone` | — |

### `GET `

**Function:** `list_projects` (line 161)

**Parameters:** `status_filter`, `page`, `limit`

**Auth:** `current_user`


### `POST `

**Function:** `create_project` (line 201)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /{project_id}`

**Function:** `get_project` (line 224)

**Parameters:** `project_id`

**Auth:** `current_user`


### `PUT /{project_id}`

**Function:** `update_project` (line 251)

**Parameters:** `project_id`, `payload`

**Auth:** `current_user`


### `DELETE /{project_id}`

**Function:** `delete_project` (line 275)

**Parameters:** `project_id`

**Auth:** `current_user`


### `GET /{project_id}/tasks`

**Function:** `list_tasks` (line 293)

**Parameters:** `project_id`, `status_filter`, `assignee`, `page`, `limit`, `fields`

**Auth:** `current_user`


### `POST /{project_id}/tasks`

**Function:** `create_task` (line 337)

**Parameters:** `project_id`, `payload`

**Auth:** `current_user`


### `PUT /{project_id}/tasks/{task_id}`

**Function:** `update_task` (line 399)

**Parameters:** `project_id`, `task_id`, `payload`

**Auth:** `current_user`


### `DELETE /{project_id}/tasks/{task_id}`

**Function:** `delete_task` (line 482)

**Parameters:** `project_id`, `task_id`

**Auth:** `current_user`


### `GET /{project_id}/board`

**Function:** `get_board` (line 504)

**Parameters:** `project_id`

**Auth:** `current_user`


### `PUT /{project_id}/board/reorder`

**Function:** `batch_reorder_tasks` (line 550)

**Parameters:** `project_id`, `payload`

**Auth:** `current_user`


### `POST /{project_id}/tasks/{task_id}/time-logs`

**Function:** `create_time_log` (line 589)

**Parameters:** `project_id`, `task_id`, `payload`

**Auth:** `current_user`


### `GET /{project_id}/tasks/{task_id}/time-logs`

**Function:** `list_task_time_logs` (line 620)

**Parameters:** `project_id`, `task_id`

**Auth:** `current_user`


### `GET /{project_id}/time-report`

**Function:** `project_time_report` (line 653)

**Parameters:** `project_id`

**Auth:** `current_user`


### `GET /{project_id}/milestones`

**Function:** `list_milestones` (line 719)

**Parameters:** `project_id`

**Auth:** `current_user`


### `POST /{project_id}/milestones`

**Function:** `create_milestone` (line 746)

**Parameters:** `project_id`, `payload`

**Auth:** `current_user`


---

## projects_automation.py

Projects API — Automation rules (no-code triggers and actions).


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/{project_id}/automations` | `create_automation_rule` | — |
| `GET` | `/{project_id}/automations` | `list_automation_rules` | — |
| `PUT` | `/{project_id}/automations/{rule_id}` | `update_automation_rule` | — |
| `DELETE` | `/{project_id}/automations/{rule_id}` | `delete_automation_rule` | — |
| `GET` | `/{project_id}/automations/templates` | `list_automation_templates` | Returns pre-built automation templates the user can use as starting points. |

### `POST /{project_id}/automations`

**Function:** `create_automation_rule` (line 73)

**Parameters:** `project_id`, `payload`

**Auth:** `current_user`


### `GET /{project_id}/automations`

**Function:** `list_automation_rules` (line 107)

**Parameters:** `project_id`

**Auth:** `current_user`


### `PUT /{project_id}/automations/{rule_id}`

**Function:** `update_automation_rule` (line 132)

**Parameters:** `project_id`, `rule_id`, `payload`

**Auth:** `current_user`


### `DELETE /{project_id}/automations/{rule_id}`

**Function:** `delete_automation_rule` (line 165)

**Parameters:** `project_id`, `rule_id`

**Auth:** `current_user`


### `GET /{project_id}/automations/templates`

**Function:** `list_automation_templates` (line 188)

Returns pre-built automation templates the user can use as starting points.

**Parameters:** `project_id`

**Auth:** `current_user`


---

## projects_comments.py

Projects API — Task comments with threading, @mentions, and activity feed.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/{project_id}/tasks/{task_id}/comments` | `create_comment` | — |
| `GET` | `/{project_id}/tasks/{task_id}/comments` | `list_comments` | — |
| `PUT` | `/{project_id}/tasks/{task_id}/comments/{comment_id}` | `update_comment` | — |
| `DELETE` | `/{project_id}/tasks/{task_id}/comments/{comment_id}` | `delete_comment` | — |
| `GET` | `/{project_id}/tasks/{task_id}/activity` | `get_task_activity` | — |

### `POST /{project_id}/tasks/{task_id}/comments`

**Function:** `create_comment` (line 70)

**Parameters:** `project_id`, `task_id`, `payload`

**Auth:** `current_user`


### `GET /{project_id}/tasks/{task_id}/comments`

**Function:** `list_comments` (line 149)

**Parameters:** `project_id`, `task_id`, `page`, `limit`

**Auth:** `current_user`


### `PUT /{project_id}/tasks/{task_id}/comments/{comment_id}`

**Function:** `update_comment` (line 200)

**Parameters:** `project_id`, `task_id`, `comment_id`, `payload`

**Auth:** `current_user`


### `DELETE /{project_id}/tasks/{task_id}/comments/{comment_id}`

**Function:** `delete_comment` (line 232)

**Parameters:** `project_id`, `task_id`, `comment_id`

**Auth:** `current_user`


### `GET /{project_id}/tasks/{task_id}/activity`

**Function:** `get_task_activity` (line 260)

**Parameters:** `project_id`, `task_id`, `page`, `limit`

**Auth:** `current_user`


---

## projects_custom_fields.py

Projects API — Custom field definitions and task field values.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/{project_id}/custom-fields` | `create_custom_field` | — |
| `GET` | `/{project_id}/custom-fields` | `list_custom_fields` | — |
| `PUT` | `/{project_id}/custom-fields/{field_id}` | `update_custom_field` | — |
| `DELETE` | `/{project_id}/custom-fields/{field_id}` | `delete_custom_field` | — |
| `PUT` | `/{project_id}/tasks/{task_id}/custom-fields` | `set_task_custom_field_values` | — |
| `GET` | `/{project_id}/tasks/{task_id}/custom-fields` | `get_task_custom_field_values` | — |

### `POST /{project_id}/custom-fields`

**Function:** `create_custom_field` (line 95)

**Parameters:** `project_id`, `payload`

**Auth:** `current_user`


### `GET /{project_id}/custom-fields`

**Function:** `list_custom_fields` (line 127)

**Parameters:** `project_id`

**Auth:** `current_user`


### `PUT /{project_id}/custom-fields/{field_id}`

**Function:** `update_custom_field` (line 152)

**Parameters:** `project_id`, `field_id`, `payload`

**Auth:** `current_user`


### `DELETE /{project_id}/custom-fields/{field_id}`

**Function:** `delete_custom_field` (line 180)

**Parameters:** `project_id`, `field_id`

**Auth:** `current_user`


### `PUT /{project_id}/tasks/{task_id}/custom-fields`

**Function:** `set_task_custom_field_values` (line 205)

**Parameters:** `project_id`, `task_id`, `payload`

**Auth:** `current_user`


### `GET /{project_id}/tasks/{task_id}/custom-fields`

**Function:** `get_task_custom_field_values` (line 276)

**Parameters:** `project_id`, `task_id`

**Auth:** `current_user`


---

## projects_email_inbound.py

Email-to-Task inbound processing via Stalwart IMAP polling.

Provides two endpoints:
  GET  /projects/email/address          — user's personal project-task email address
  POST /projects/email/process-inbound  — internal webhook called by Celery beat

Any email sent to tasks+<hash>@erp.local will be automatically converted to a
task in the user's default (most recently active) project.  The Celery IMAP
polling task resolves the destination address to a user_id and calls this
endpoint with the parsed email payload.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/email/address` | `get_task_email_address` | Return the inbound email address that creates tasks on behalf of the user. |
| `POST` | `/email/process-inbound` | `process_inbound_email` | Create a task from an inbound email message. |

### `GET /email/address`

**Function:** `get_task_email_address` (line 60)

Return the inbound email address that creates tasks on behalf of the user.

Any email sent to this address will become a new task in the user's most
recently created project. The subject becomes the task title and the body
becomes the task description.

**Auth:** `current_user`


### `POST /email/process-inbound`

**Function:** `process_inbound_email` (line 82)

Create a task from an inbound email message.

Called internally by the Celery beat IMAP polling task.  No user JWT
authentication is required (trusted internal call).  In a production
hardened deployment you would verify an internal API key header here.

**Parameters:** `payload`


---

## projects_ext.py

Projects Extensions API — Dependencies, Milestones v2, Timeline, Reports, Templates.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `PUT` | `/tasks/{task_id}/position` | `update_task_position` | — |
| `POST` | `/tasks/{task_id}/dependencies` | `create_dependency` | — |
| `DELETE` | `/tasks/{task_id}/dependencies/{dep_id}` | `delete_dependency` | — |
| `GET` | `/tasks/{task_id}/dependencies` | `list_dependencies` | — |
| `GET` | `/{project_id}/milestones-v2` | `list_milestones_v2` | — |
| `POST` | `/{project_id}/milestones-v2` | `create_milestone_v2` | — |
| `PUT` | `/milestones-v2/{milestone_id}` | `update_milestone_v2` | — |
| `DELETE` | `/milestones-v2/{milestone_id}` | `delete_milestone_v2` | — |
| `GET` | `/{project_id}/timeline` | `get_timeline` | — |
| `GET` | `/{project_id}/report` | `get_project_report` | — |
| `GET` | `/templates` | `list_templates` | — |
| `POST` | `/templates` | `create_template` | — |
| `POST` | `/from-template` | `create_project_from_template` | — |

### `PUT /tasks/{task_id}/position`

**Function:** `update_task_position` (line 147)

**Parameters:** `task_id`, `payload`

**Auth:** `current_user`


### `POST /tasks/{task_id}/dependencies`

**Function:** `create_dependency` (line 177)

**Parameters:** `task_id`, `payload`

**Auth:** `current_user`


### `DELETE /tasks/{task_id}/dependencies/{dep_id}`

**Function:** `delete_dependency` (line 230)

**Parameters:** `task_id`, `dep_id`

**Auth:** `current_user`


### `GET /tasks/{task_id}/dependencies`

**Function:** `list_dependencies` (line 252)

**Parameters:** `task_id`

**Auth:** `current_user`


### `GET /{project_id}/milestones-v2`

**Function:** `list_milestones_v2` (line 287)

**Parameters:** `project_id`

**Auth:** `current_user`


### `POST /{project_id}/milestones-v2`

**Function:** `create_milestone_v2` (line 313)

**Parameters:** `project_id`, `payload`

**Auth:** `current_user`


### `PUT /milestones-v2/{milestone_id}`

**Function:** `update_milestone_v2` (line 336)

**Parameters:** `milestone_id`, `payload`

**Auth:** `current_user`


### `DELETE /milestones-v2/{milestone_id}`

**Function:** `delete_milestone_v2` (line 369)

**Parameters:** `milestone_id`

**Auth:** `current_user`


### `GET /{project_id}/timeline`

**Function:** `get_timeline` (line 390)

**Parameters:** `project_id`

**Auth:** `current_user`


### `GET /{project_id}/report`

**Function:** `get_project_report` (line 458)

**Parameters:** `project_id`

**Auth:** `current_user`


### `GET /templates`

**Function:** `list_templates` (line 543)

**Auth:** `current_user`


### `POST /templates`

**Function:** `create_template` (line 564)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /from-template`

**Function:** `create_project_from_template` (line 587)

**Parameters:** `payload`

**Auth:** `current_user`


---

## projects_guests.py

Projects API — Guest Access (invite, list, revoke, token-view).

Endpoints:
  POST   /projects/{id}/guests             — invite an external collaborator
  GET    /projects/{id}/guests             — list all guest tokens for a project
  DELETE /projects/{id}/guests/{guest_id}  — revoke a guest invitation
  GET    /projects/guest-view/{token}      — public token-based read-only view


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/projects/{project_id}/guests` | `invite_guest` | — |
| `GET` | `/projects/{project_id}/guests` | `list_guests` | — |
| `DELETE` | `/projects/{project_id}/guests/{guest_id}` | `revoke_guest` | — |
| `GET` | `/projects/guest-view/{token}` | `guest_token_view` | — |

### `POST /projects/{project_id}/guests`

**Function:** `invite_guest` (line 78)

**Parameters:** `project_id`, `body`

**Response model:** `GuestInviteOut`

**Auth:** `current_user`


### `GET /projects/{project_id}/guests`

**Function:** `list_guests` (line 112)

**Parameters:** `project_id`

**Auth:** `current_user`


### `DELETE /projects/{project_id}/guests/{guest_id}`

**Function:** `revoke_guest` (line 135)

**Parameters:** `project_id`, `guest_id`

**Auth:** `current_user`


### `GET /projects/guest-view/{token}`

**Function:** `guest_token_view` (line 161)

**Parameters:** `token`

**Response model:** `GuestProjectView`


---

## projects_integrations.py

Projects cross-module integrations API.

Provides soft links between Projects and other modules:
  1. Projects -> Drive: auto-create/link a Drive folder per project, list files
  2. Projects -> Docs: create documents from project context
  3. Projects -> CRM: link projects to deals
  4. Projects -> Finance: cost tracking (time * rate + linked expenses)


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/{project_id}/link-drive` | `link_drive_folder` | — |
| `GET` | `/{project_id}/files` | `list_project_files` | — |
| `POST` | `/{project_id}/create-document` | `create_project_document` | — |
| `GET` | `/{project_id}/documents` | `list_project_documents` | — |
| `POST` | `/{project_id}/link-deal` | `link_deal` | — |
| `GET` | `/{project_id}/linked-deals` | `list_linked_deals` | — |
| `DELETE` | `/{project_id}/unlink-deal/{deal_id}` | `unlink_deal` | — |
| `GET` | `/{project_id}/costs` | `get_project_costs` | — |
| `POST` | `/{project_id}/link-expense` | `link_expense` | — |
| `DELETE` | `/{project_id}/unlink-expense/{expense_id}` | `unlink_expense` | — |

### `POST /{project_id}/link-drive`

**Function:** `link_drive_folder` (line 148)

**Parameters:** `project_id`

**Auth:** `current_user`


### `GET /{project_id}/files`

**Function:** `list_project_files` (line 200)

**Parameters:** `project_id`

**Auth:** `current_user`


### `POST /{project_id}/create-document`

**Function:** `create_project_document` (line 256)

**Parameters:** `project_id`, `payload`

**Auth:** `current_user`


### `GET /{project_id}/documents`

**Function:** `list_project_documents` (line 326)

**Parameters:** `project_id`

**Auth:** `current_user`


### `POST /{project_id}/link-deal`

**Function:** `link_deal` (line 357)

**Parameters:** `project_id`, `payload`

**Auth:** `current_user`


### `GET /{project_id}/linked-deals`

**Function:** `list_linked_deals` (line 410)

**Parameters:** `project_id`

**Auth:** `current_user`


### `DELETE /{project_id}/unlink-deal/{deal_id}`

**Function:** `unlink_deal` (line 454)

**Parameters:** `project_id`, `deal_id`

**Auth:** `current_user`


### `GET /{project_id}/costs`

**Function:** `get_project_costs` (line 491)

**Parameters:** `project_id`, `hourly_rate`

**Auth:** `current_user`


### `POST /{project_id}/link-expense`

**Function:** `link_expense` (line 566)

**Parameters:** `project_id`, `payload`

**Auth:** `current_user`


### `DELETE /{project_id}/unlink-expense/{expense_id}`

**Function:** `unlink_expense` (line 619)

**Parameters:** `project_id`, `expense_id`

**Auth:** `current_user`


---

## projects_recurring.py

Projects API — Recurring task configurations.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/{project_id}/recurring` | `create_recurring_config` | — |
| `GET` | `/{project_id}/recurring` | `list_recurring_configs` | — |
| `PUT` | `/{project_id}/recurring/{config_id}` | `update_recurring_config` | — |
| `DELETE` | `/{project_id}/recurring/{config_id}` | `delete_recurring_config` | — |
| `POST` | `/{project_id}/recurring/{config_id}/trigger` | `trigger_recurring_task` | — |

### `POST /{project_id}/recurring`

**Function:** `create_recurring_config` (line 103)

**Parameters:** `project_id`, `payload`

**Auth:** `current_user`


### `GET /{project_id}/recurring`

**Function:** `list_recurring_configs` (line 151)

**Parameters:** `project_id`

**Auth:** `current_user`


### `PUT /{project_id}/recurring/{config_id}`

**Function:** `update_recurring_config` (line 176)

**Parameters:** `project_id`, `config_id`, `payload`

**Auth:** `current_user`


### `DELETE /{project_id}/recurring/{config_id}`

**Function:** `delete_recurring_config` (line 204)

**Parameters:** `project_id`, `config_id`

**Auth:** `current_user`


### `POST /{project_id}/recurring/{config_id}/trigger`

**Function:** `trigger_recurring_task` (line 227)

**Parameters:** `project_id`, `config_id`

**Auth:** `current_user`


---

## projects_sprints.py

Projects API — Sprints, backlog, calendar view, and bulk operations.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/{project_id}/sprints` | `create_sprint` | — |
| `GET` | `/{project_id}/sprints` | `list_sprints` | — |
| `PUT` | `/{project_id}/sprints/{sprint_id}` | `update_sprint` | — |
| `DELETE` | `/{project_id}/sprints/{sprint_id}` | `delete_sprint` | — |
| `PUT` | `/{project_id}/tasks/{task_id}/sprint` | `assign_task_to_sprint` | — |
| `GET` | `/{project_id}/backlog` | `get_backlog` | — |
| `GET` | `/{project_id}/calendar` | `get_calendar_tasks` | — |
| `PUT` | `/{project_id}/tasks/bulk` | `bulk_update_tasks` | — |

### `POST /{project_id}/sprints`

**Function:** `create_sprint` (line 78)

**Parameters:** `project_id`, `payload`

**Auth:** `current_user`


### `GET /{project_id}/sprints`

**Function:** `list_sprints` (line 108)

**Parameters:** `project_id`

**Auth:** `current_user`


### `PUT /{project_id}/sprints/{sprint_id}`

**Function:** `update_sprint` (line 141)

**Parameters:** `project_id`, `sprint_id`, `payload`

**Auth:** `current_user`


### `DELETE /{project_id}/sprints/{sprint_id}`

**Function:** `delete_sprint` (line 169)

**Parameters:** `project_id`, `sprint_id`

**Auth:** `current_user`


### `PUT /{project_id}/tasks/{task_id}/sprint`

**Function:** `assign_task_to_sprint` (line 199)

**Parameters:** `project_id`, `task_id`, `payload`

**Auth:** `current_user`


### `GET /{project_id}/backlog`

**Function:** `get_backlog` (line 230)

**Parameters:** `project_id`, `page`, `limit`

**Auth:** `current_user`


### `GET /{project_id}/calendar`

**Function:** `get_calendar_tasks` (line 281)

**Parameters:** `project_id`, `start`, `end`

**Auth:** `current_user`


### `PUT /{project_id}/tasks/bulk`

**Function:** `bulk_update_tasks` (line 330)

**Parameters:** `project_id`, `payload`

**Auth:** `current_user`


---

## projects_subtasks.py

Projects API — Subtasks, checklists, task relationships, and audit log.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/{project_id}/tasks/{task_id}/subtasks` | `create_subtask` | — |
| `GET` | `/{project_id}/tasks/{task_id}/subtasks` | `list_subtasks` | — |
| `PUT` | `/{project_id}/tasks/{task_id}/reparent` | `reparent_task` | — |
| `POST` | `/{project_id}/tasks/{task_id}/checklists` | `create_checklist_item` | — |
| `GET` | `/{project_id}/tasks/{task_id}/checklists` | `list_checklist_items` | — |
| `PUT` | `/{project_id}/tasks/{task_id}/checklists/{item_id}` | `update_checklist_item` | — |
| `DELETE` | `/{project_id}/tasks/{task_id}/checklists/{item_id}` | `delete_checklist_item` | — |
| `POST` | `/{project_id}/tasks/{task_id}/relationships` | `create_relationship` | — |
| `GET` | `/{project_id}/tasks/{task_id}/relationships` | `list_relationships` | — |
| `DELETE` | `/{project_id}/tasks/{task_id}/relationships/{rel_id}` | `delete_relationship` | — |
| `GET` | `/{project_id}/tasks/{task_id}/audit-log` | `get_task_audit_log` | — |

### `POST /{project_id}/tasks/{task_id}/subtasks`

**Function:** `create_subtask` (line 160)

**Parameters:** `project_id`, `task_id`, `payload`

**Auth:** `current_user`


### `GET /{project_id}/tasks/{task_id}/subtasks`

**Function:** `list_subtasks` (line 212)

**Parameters:** `project_id`, `task_id`

**Auth:** `current_user`


### `PUT /{project_id}/tasks/{task_id}/reparent`

**Function:** `reparent_task` (line 236)

**Parameters:** `project_id`, `task_id`, `payload`

**Auth:** `current_user`


### `POST /{project_id}/tasks/{task_id}/checklists`

**Function:** `create_checklist_item` (line 274)

**Parameters:** `project_id`, `task_id`, `payload`

**Auth:** `current_user`


### `GET /{project_id}/tasks/{task_id}/checklists`

**Function:** `list_checklist_items` (line 298)

**Parameters:** `project_id`, `task_id`

**Auth:** `current_user`


### `PUT /{project_id}/tasks/{task_id}/checklists/{item_id}`

**Function:** `update_checklist_item` (line 327)

**Parameters:** `project_id`, `task_id`, `item_id`, `payload`

**Auth:** `current_user`


### `DELETE /{project_id}/tasks/{task_id}/checklists/{item_id}`

**Function:** `delete_checklist_item` (line 370)

**Parameters:** `project_id`, `task_id`, `item_id`

**Auth:** `current_user`


### `POST /{project_id}/tasks/{task_id}/relationships`

**Function:** `create_relationship` (line 398)

**Parameters:** `project_id`, `task_id`, `payload`

**Auth:** `current_user`


### `GET /{project_id}/tasks/{task_id}/relationships`

**Function:** `list_relationships` (line 443)

**Parameters:** `project_id`, `task_id`

**Auth:** `current_user`


### `DELETE /{project_id}/tasks/{task_id}/relationships/{rel_id}`

**Function:** `delete_relationship` (line 474)

**Parameters:** `project_id`, `task_id`, `rel_id`

**Auth:** `current_user`


### `GET /{project_id}/tasks/{task_id}/audit-log`

**Function:** `get_task_audit_log` (line 498)

**Parameters:** `project_id`, `task_id`, `page`, `limit`

**Auth:** `current_user`

