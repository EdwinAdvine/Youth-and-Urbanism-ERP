# CRM — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 191


## Contents

- [crm.py](#crm) (19 endpoints)
- [crm_activities.py](#crm-activities) (4 endpoints)
- [crm_ai_agents.py](#crm-ai-agents) (10 endpoints)
- [crm_audit.py](#crm-audit) (4 endpoints)
- [crm_collaboration.py](#crm-collaboration) (8 endpoints)
- [crm_contacts_v2.py](#crm-contacts-v2) (7 endpoints)
- [crm_custom_fields.py](#crm-custom-fields) (4 endpoints)
- [crm_custom_objects.py](#crm-custom-objects) (12 endpoints)
- [crm_ext.py](#crm-ext) (22 endpoints)
- [crm_links.py](#crm-links) (8 endpoints)
- [crm_marketing.py](#crm-marketing) (14 endpoints)
- [crm_pipelines.py](#crm-pipelines) (6 endpoints)
- [crm_reports_v2.py](#crm-reports-v2) (13 endpoints)
- [crm_scoring.py](#crm-scoring) (7 endpoints)
- [crm_sequences.py](#crm-sequences) (10 endpoints)
- [crm_service.py](#crm-service) (17 endpoints)
- [crm_templates.py](#crm-templates) (6 endpoints)
- [crm_tickets.py](#crm-tickets) (6 endpoints)
- [crm_workflows.py](#crm-workflows) (14 endpoints)

---

## crm.py

CRM API — CRUD for contacts, leads, opportunities, deals, pipeline & dashboard.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/contacts` | `list_contacts` | — |
| `POST` | `/contacts` | `create_contact` | — |
| `GET` | `/contacts/{contact_id}` | `get_contact` | — |
| `PUT` | `/contacts/{contact_id}` | `update_contact` | — |
| `DELETE` | `/contacts/{contact_id}` | `delete_contact` | — |
| `GET` | `/leads` | `list_leads` | — |
| `POST` | `/leads` | `create_lead` | — |
| `GET` | `/leads/{lead_id}` | `get_lead` | — |
| `PUT` | `/leads/{lead_id}` | `update_lead` | — |
| `POST` | `/leads/{lead_id}/convert` | `convert_lead` | — |
| `GET` | `/opportunities` | `list_opportunities` | — |
| `POST` | `/opportunities` | `create_opportunity` | — |
| `GET` | `/opportunities/{opportunity_id}` | `get_opportunity` | — |
| `PUT` | `/opportunities/{opportunity_id}` | `update_opportunity` | — |
| `POST` | `/opportunities/{opportunity_id}/close-won` | `close_won` | — |
| `POST` | `/opportunities/{opportunity_id}/close-lost` | `close_lost` | — |
| `GET` | `/deals` | `list_deals` | — |
| `GET` | `/pipeline` | `pipeline_view` | — |
| `GET` | `/dashboard/stats` | `dashboard` | — |

### `GET /contacts`

**Function:** `list_contacts` (line 177)

**Parameters:** `contact_type`, `tags`, `source`, `search`, `page`, `limit`, `fields`

**Auth:** `current_user`


### `POST /contacts`

**Function:** `create_contact` (line 227)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /contacts/{contact_id}`

**Function:** `get_contact` (line 253)

**Parameters:** `contact_id`

**Auth:** `current_user`


### `PUT /contacts/{contact_id}`

**Function:** `update_contact` (line 274)

**Parameters:** `contact_id`, `payload`

**Auth:** `current_user`


### `DELETE /contacts/{contact_id}`

**Function:** `delete_contact` (line 298)

**Parameters:** `contact_id`

**Auth:** `current_user`


### `GET /leads`

**Function:** `list_leads` (line 317)

**Parameters:** `status_filter`, `assigned_to`, `page`, `limit`

**Auth:** `current_user`


### `POST /leads`

**Function:** `create_lead` (line 348)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /leads/{lead_id}`

**Function:** `get_lead` (line 379)

**Parameters:** `lead_id`

**Auth:** `current_user`


### `PUT /leads/{lead_id}`

**Function:** `update_lead` (line 404)

**Parameters:** `lead_id`, `payload`

**Auth:** `current_user`


### `POST /leads/{lead_id}/convert`

**Function:** `convert_lead` (line 424)

**Parameters:** `lead_id`

**Auth:** `current_user`


### `GET /opportunities`

**Function:** `list_opportunities` (line 465)

**Parameters:** `stage`, `assigned_to`, `page`, `limit`

**Auth:** `current_user`


### `POST /opportunities`

**Function:** `create_opportunity` (line 500)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /opportunities/{opportunity_id}`

**Function:** `get_opportunity` (line 525)

**Parameters:** `opportunity_id`

**Auth:** `current_user`


### `PUT /opportunities/{opportunity_id}`

**Function:** `update_opportunity` (line 550)

**Parameters:** `opportunity_id`, `payload`

**Auth:** `current_user`


### `POST /opportunities/{opportunity_id}/close-won`

**Function:** `close_won` (line 584)

**Parameters:** `opportunity_id`

**Auth:** `current_user`


### `POST /opportunities/{opportunity_id}/close-lost`

**Function:** `close_lost` (line 628)

**Parameters:** `opportunity_id`

**Auth:** `current_user`


### `GET /deals`

**Function:** `list_deals` (line 651)

**Parameters:** `status_filter`, `page`, `limit`

**Auth:** `current_user`


### `GET /pipeline`

**Function:** `pipeline_view` (line 681)

**Auth:** `current_user`


### `GET /dashboard/stats`

**Function:** `dashboard` (line 708)

**Auth:** `current_user`


---

## crm_activities.py

CRM Sales Activities — unified activity log CRUD.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/activities` | `list_activities` | — |
| `POST` | `/activities` | `create_activity` | — |
| `PUT` | `/activities/{activity_id}` | `update_activity` | — |
| `DELETE` | `/activities/{activity_id}` | `delete_activity` | — |

### `GET /activities`

**Function:** `list_activities` (line 72)

**Parameters:** `activity_type`, `contact_id`, `lead_id`, `opportunity_id`, `deal_id`, `page`, `limit`

**Auth:** `current_user`


### `POST /activities`

**Function:** `create_activity` (line 107)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /activities/{activity_id}`

**Function:** `update_activity` (line 144)

**Parameters:** `activity_id`, `payload`

**Auth:** `current_user`


### `DELETE /activities/{activity_id}`

**Function:** `delete_activity` (line 161)

**Parameters:** `activity_id`

**Auth:** `current_user`


---

## crm_ai_agents.py


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/ai-agents` | `list_agent_configs` | — |
| `POST` | `/ai-agents` | `create_agent_config` | — |
| `GET` | `/ai-agents/{agent_id}` | `get_agent_config` | — |
| `PUT` | `/ai-agents/{agent_id}` | `update_agent_config` | — |
| `DELETE` | `/ai-agents/{agent_id}` | `delete_agent_config` | — |
| `POST` | `/ai-agents/{agent_id}/run` | `trigger_agent_run` | — |
| `GET` | `/ai-agents/{agent_id}/runs` | `list_agent_runs` | — |
| `GET` | `/ai-agent-runs/{run_id}` | `get_agent_run` | — |
| `POST` | `/ai-agent-runs/{run_id}/approve` | `approve_agent_run` | — |
| `POST` | `/ai-agent-runs/{run_id}/reject` | `reject_agent_run` | — |

### `GET /ai-agents`

**Function:** `list_agent_configs` (line 84)

**Parameters:** `agent_type`, `is_active`, `skip`, `limit`

**Auth:** `current_user`


### `POST /ai-agents`

**Function:** `create_agent_config` (line 109)

**Parameters:** `body`

**Auth:** `current_user`


### `GET /ai-agents/{agent_id}`

**Function:** `get_agent_config` (line 122)

**Parameters:** `agent_id`

**Auth:** `current_user`


### `PUT /ai-agents/{agent_id}`

**Function:** `update_agent_config` (line 134)

**Parameters:** `agent_id`, `body`

**Auth:** `current_user`


### `DELETE /ai-agents/{agent_id}`

**Function:** `delete_agent_config` (line 153)

**Parameters:** `agent_id`

**Auth:** `current_user`


### `POST /ai-agents/{agent_id}/run`

**Function:** `trigger_agent_run` (line 173)

**Parameters:** `agent_id`, `body`

**Auth:** `current_user`


### `GET /ai-agents/{agent_id}/runs`

**Function:** `list_agent_runs` (line 188)

**Parameters:** `agent_id`, `run_status`, `skip`, `limit`

**Auth:** `current_user`


### `GET /ai-agent-runs/{run_id}`

**Function:** `get_agent_run` (line 214)

**Parameters:** `run_id`

**Auth:** `current_user`


### `POST /ai-agent-runs/{run_id}/approve`

**Function:** `approve_agent_run` (line 226)

**Parameters:** `run_id`

**Auth:** `current_user`


### `POST /ai-agent-runs/{run_id}/reject`

**Function:** `reject_agent_run` (line 245)

**Parameters:** `run_id`

**Auth:** `current_user`


---

## crm_audit.py

CRM Audit Log — endpoints for viewing and recording CRM entity audit trails.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/audit-log` | `list_audit_logs` | List all audit entries with optional filters, ordered by created_at desc. |
| `GET` | `/audit-log/entity/{entity_type}/{entity_id}` | `get_entity_audit_trail` | Get the full audit trail for a specific entity, ordered by created_at desc. |
| `GET` | `/audit-log/stats` | `get_audit_stats` | Count of actions by type in the last 30 days. |
| `POST` | `/audit-log` | `create_audit_entry` | Record a new audit log entry (used internally / by middleware). |

### `GET /audit-log`

**Function:** `list_audit_logs` (line 55)

List all audit entries with optional filters, ordered by created_at desc.

**Parameters:** `entity_type`, `action`, `user_id`, `start_date`, `end_date`, `skip`, `limit`

**Response model:** `dict`

**Auth:** `current_user`


### `GET /audit-log/entity/{entity_type}/{entity_id}`

**Function:** `get_entity_audit_trail` (line 90)

Get the full audit trail for a specific entity, ordered by created_at desc.

**Parameters:** `entity_type`, `entity_id`, `skip`, `limit`

**Response model:** `dict`

**Auth:** `current_user`


### `GET /audit-log/stats`

**Function:** `get_audit_stats` (line 114)

Count of actions by type in the last 30 days.

**Auth:** `current_user`


### `POST /audit-log`

**Function:** `create_audit_entry` (line 133)

Record a new audit log entry (used internally / by middleware).

**Parameters:** `payload`

**Response model:** `AuditLogOut`

**Auth:** `current_user`


---

## crm_collaboration.py


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/comments` | `list_comments` | List comments for an entity, returned as a threaded structure. |
| `POST` | `/comments` | `create_comment` | Create a comment on an entity. |
| `PUT` | `/comments/{comment_id}` | `update_comment` | Update comment content. Only the author may edit. |
| `DELETE` | `/comments/{comment_id}` | `delete_comment` | Delete a comment. Allowed for the author or an admin. |
| `GET` | `/followers` | `list_followers` | List all followers for a given entity. |
| `POST` | `/followers` | `follow_record` | Follow a record. Prevents duplicate follows. |
| `DELETE` | `/followers/{follower_id}` | `unfollow_record` | Unfollow a record. |
| `GET` | `/followers/my` | `list_my_follows` | List all records the current user is following (paginated). |

### `GET /comments`

**Function:** `list_comments` (line 72)

List comments for an entity, returned as a threaded structure.

**Parameters:** `entity_type`, `entity_id`, `skip`, `limit`

**Auth:** `current_user`


### `POST /comments`

**Function:** `create_comment` (line 123)

Create a comment on an entity.

**Parameters:** `body`

**Auth:** `current_user`


### `PUT /comments/{comment_id}`

**Function:** `update_comment` (line 157)

Update comment content. Only the author may edit.

**Parameters:** `comment_id`, `body`

**Auth:** `current_user`


### `DELETE /comments/{comment_id}`

**Function:** `delete_comment` (line 179)

Delete a comment. Allowed for the author or an admin.

**Parameters:** `comment_id`

**Auth:** `current_user`


### `GET /followers`

**Function:** `list_followers` (line 208)

List all followers for a given entity.

**Parameters:** `entity_type`, `entity_id`

**Auth:** `current_user`


### `POST /followers`

**Function:** `follow_record` (line 226)

Follow a record. Prevents duplicate follows.

**Parameters:** `body`

**Auth:** `current_user`


### `DELETE /followers/{follower_id}`

**Function:** `unfollow_record` (line 254)

Unfollow a record.

**Parameters:** `follower_id`

**Auth:** `current_user`


### `GET /followers/my`

**Function:** `list_my_follows` (line 273)

List all records the current user is following (paginated).

**Parameters:** `skip`, `limit`

**Auth:** `current_user`


---

## crm_contacts_v2.py

CRM Contacts V2 — 360° view, notes, duplicate detection & merge.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/contacts/{contact_id}/360` | `contact_360` | — |
| `GET` | `/contacts/{contact_id}/notes` | `list_notes` | — |
| `POST` | `/contacts/{contact_id}/notes` | `create_note` | — |
| `POST` | `/contacts/detect-duplicates` | `run_duplicate_detection` | — |
| `GET` | `/duplicates` | `list_duplicates` | — |
| `POST` | `/duplicates/{candidate_id}/merge` | `merge_duplicate` | — |
| `POST` | `/duplicates/{candidate_id}/dismiss` | `dismiss_duplicate` | — |

### `GET /contacts/{contact_id}/360`

**Function:** `contact_360` (line 73)

**Parameters:** `contact_id`

**Auth:** `current_user`


### `GET /contacts/{contact_id}/notes`

**Function:** `list_notes` (line 170)

**Parameters:** `contact_id`, `page`, `limit`

**Auth:** `current_user`


### `POST /contacts/{contact_id}/notes`

**Function:** `create_note` (line 194)

**Parameters:** `contact_id`, `payload`

**Auth:** `current_user`


### `POST /contacts/detect-duplicates`

**Function:** `run_duplicate_detection` (line 221)

**Auth:** `current_user`


### `GET /duplicates`

**Function:** `list_duplicates` (line 231)

**Parameters:** `status_filter`, `page`, `limit`

**Auth:** `current_user`


### `POST /duplicates/{candidate_id}/merge`

**Function:** `merge_duplicate` (line 251)

**Parameters:** `candidate_id`, `payload`

**Auth:** `current_user`


### `POST /duplicates/{candidate_id}/dismiss`

**Function:** `dismiss_duplicate` (line 265)

**Parameters:** `candidate_id`

**Auth:** `current_user`


---

## crm_custom_fields.py

CRM Custom Fields — CRUD for user-defined field definitions.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/custom-fields` | `list_custom_fields` | — |
| `POST` | `/custom-fields` | `create_custom_field` | — |
| `PUT` | `/custom-fields/{field_id}` | `update_custom_field` | — |
| `DELETE` | `/custom-fields/{field_id}` | `delete_custom_field` | — |

### `GET /custom-fields`

**Function:** `list_custom_fields` (line 59)

**Parameters:** `entity_type`

**Auth:** `current_user`


### `POST /custom-fields`

**Function:** `create_custom_field` (line 73)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /custom-fields/{field_id}`

**Function:** `update_custom_field` (line 96)

**Parameters:** `field_id`, `payload`

**Auth:** `current_user`


### `DELETE /custom-fields/{field_id}`

**Function:** `delete_custom_field` (line 113)

**Parameters:** `field_id`

**Auth:** `current_user`


---

## crm_custom_objects.py

CRM Custom Objects — CRUD for user-defined object definitions, records & relationships.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/custom-objects` | `list_custom_object_definitions` | — |
| `POST` | `/custom-objects` | `create_custom_object_definition` | — |
| `GET` | `/custom-objects/{definition_id}` | `get_custom_object_definition` | — |
| `PUT` | `/custom-objects/{definition_id}` | `update_custom_object_definition` | — |
| `DELETE` | `/custom-objects/{definition_id}` | `delete_custom_object_definition` | — |
| `GET` | `/custom-objects/{definition_id}/records` | `list_custom_object_records` | — |
| `POST` | `/custom-objects/{definition_id}/records` | `create_custom_object_record` | — |
| `GET` | `/custom-object-records/{record_id}` | `get_custom_object_record` | — |
| `PUT` | `/custom-object-records/{record_id}` | `update_custom_object_record` | — |
| `DELETE` | `/custom-object-records/{record_id}` | `delete_custom_object_record` | — |
| `POST` | `/custom-object-records/{record_id}/relationships` | `add_record_relationship` | — |
| `DELETE` | `/custom-object-records/{record_id}/relationships/{rel_id}` | `remove_record_relationship` | — |

### `GET /custom-objects`

**Function:** `list_custom_object_definitions` (line 165)

**Parameters:** `is_active`, `skip`, `limit`

**Auth:** `current_user`


### `POST /custom-objects`

**Function:** `create_custom_object_definition` (line 199)

**Parameters:** `body`

**Auth:** `current_user`


### `GET /custom-objects/{definition_id}`

**Function:** `get_custom_object_definition` (line 238)

**Parameters:** `definition_id`

**Auth:** `current_user`


### `PUT /custom-objects/{definition_id}`

**Function:** `update_custom_object_definition` (line 259)

**Parameters:** `definition_id`, `body`

**Auth:** `current_user`


### `DELETE /custom-objects/{definition_id}`

**Function:** `delete_custom_object_definition` (line 297)

**Parameters:** `definition_id`

**Auth:** `current_user`


### `GET /custom-objects/{definition_id}/records`

**Function:** `list_custom_object_records` (line 348)

**Parameters:** `definition_id`, `skip`, `limit`

**Auth:** `current_user`


### `POST /custom-objects/{definition_id}/records`

**Function:** `create_custom_object_record` (line 395)

**Parameters:** `definition_id`, `body`

**Auth:** `current_user`


### `GET /custom-object-records/{record_id}`

**Function:** `get_custom_object_record` (line 436)

**Parameters:** `record_id`

**Auth:** `current_user`


### `PUT /custom-object-records/{record_id}`

**Function:** `update_custom_object_record` (line 460)

**Parameters:** `record_id`, `body`

**Auth:** `current_user`


### `DELETE /custom-object-records/{record_id}`

**Function:** `delete_custom_object_record` (line 501)

**Parameters:** `record_id`

**Auth:** `current_user`


### `POST /custom-object-records/{record_id}/relationships`

**Function:** `add_record_relationship` (line 541)

**Parameters:** `record_id`, `body`

**Auth:** `current_user`


### `DELETE /custom-object-records/{record_id}/relationships/{rel_id}`

**Function:** `remove_record_relationship` (line 575)

**Parameters:** `record_id`, `rel_id`

**Auth:** `current_user`


---

## crm_ext.py

CRM Extensions — campaigns, quotes, products, reports, contact import/export.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/campaigns` | `list_campaigns` | — |
| `POST` | `/campaigns` | `create_campaign` | — |
| `GET` | `/campaigns/{campaign_id}` | `get_campaign` | — |
| `PUT` | `/campaigns/{campaign_id}` | `update_campaign` | — |
| `DELETE` | `/campaigns/{campaign_id}` | `delete_campaign` | — |
| `GET` | `/campaigns/{campaign_id}/analytics` | `campaign_analytics` | — |
| `POST` | `/campaigns/{campaign_id}/send` | `send_campaign` | — |
| `GET` | `/quotes` | `list_quotes` | — |
| `POST` | `/quotes` | `create_quote` | — |
| `GET` | `/quotes/{quote_id}` | `get_quote` | — |
| `PUT` | `/quotes/{quote_id}` | `update_quote` | — |
| `POST` | `/quotes/{quote_id}/send` | `send_quote` | — |
| `GET` | `/products` | `list_products` | — |
| `POST` | `/products` | `create_product` | — |
| `GET` | `/products/{product_id}` | `get_product` | — |
| `PUT` | `/products/{product_id}` | `update_product` | — |
| `DELETE` | `/products/{product_id}` | `delete_product` | — |
| `GET` | `/reports/pipeline` | `pipeline_report` | Conversion rates: how many opportunities move from one stage to the next. |
| `GET` | `/reports/sales-forecast` | `sales_forecast` | Weighted forecast: expected_value * probability / 100 for open opportunities. |
| `GET` | `/contacts/{contact_id}/timeline` | `contact_timeline` | Aggregate all CRM activities for a contact: leads, opportunities, deals, quot... |
| `POST` | `/contacts/import` | `import_contacts` | Import contacts from a CSV file. Expected columns: contact_type, first_name, ... |
| `GET` | `/contacts/export` | `export_contacts` | Download all active contacts as a CSV file. |

### `GET /campaigns`

**Function:** `list_campaigns` (line 159)

**Parameters:** `status_filter`, `campaign_type`, `page`, `limit`

**Auth:** `current_user`


### `POST /campaigns`

**Function:** `create_campaign` (line 188)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /campaigns/{campaign_id}`

**Function:** `get_campaign` (line 218)

**Parameters:** `campaign_id`

**Auth:** `current_user`


### `PUT /campaigns/{campaign_id}`

**Function:** `update_campaign` (line 239)

**Parameters:** `campaign_id`, `payload`

**Auth:** `current_user`


### `DELETE /campaigns/{campaign_id}`

**Function:** `delete_campaign` (line 262)

**Parameters:** `campaign_id`

**Auth:** `current_user`


### `GET /campaigns/{campaign_id}/analytics`

**Function:** `campaign_analytics` (line 277)

**Parameters:** `campaign_id`

**Auth:** `current_user`


### `POST /campaigns/{campaign_id}/send`

**Function:** `send_campaign` (line 322)

**Parameters:** `campaign_id`

**Auth:** `current_user`


### `GET /quotes`

**Function:** `list_quotes` (line 366)

**Parameters:** `status_filter`, `contact_id`, `page`, `limit`

**Auth:** `current_user`


### `POST /quotes`

**Function:** `create_quote` (line 395)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /quotes/{quote_id}`

**Function:** `get_quote` (line 433)

**Parameters:** `quote_id`

**Auth:** `current_user`


### `PUT /quotes/{quote_id}`

**Function:** `update_quote` (line 457)

**Parameters:** `quote_id`, `payload`

**Auth:** `current_user`


### `POST /quotes/{quote_id}/send`

**Function:** `send_quote` (line 476)

**Parameters:** `quote_id`

**Auth:** `current_user`


### `GET /products`

**Function:** `list_products` (line 507)

**Parameters:** `category`, `active_only`, `search`, `page`, `limit`

**Auth:** `current_user`


### `POST /products`

**Function:** `create_product` (line 546)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /products/{product_id}`

**Function:** `get_product` (line 566)

**Parameters:** `product_id`

**Auth:** `current_user`


### `PUT /products/{product_id}`

**Function:** `update_product` (line 578)

**Parameters:** `product_id`, `payload`

**Auth:** `current_user`


### `DELETE /products/{product_id}`

**Function:** `delete_product` (line 601)

**Parameters:** `product_id`

**Auth:** `current_user`


### `GET /reports/pipeline`

**Function:** `pipeline_report` (line 618)

Conversion rates: how many opportunities move from one stage to the next.

**Auth:** `current_user`


### `GET /reports/sales-forecast`

**Function:** `sales_forecast` (line 664)

Weighted forecast: expected_value * probability / 100 for open opportunities.

**Parameters:** `months_ahead`

**Auth:** `current_user`


### `GET /contacts/{contact_id}/timeline`

**Function:** `contact_timeline` (line 709)

Aggregate all CRM activities for a contact: leads, opportunities, deals, quotes, campaigns.

**Parameters:** `contact_id`

**Auth:** `current_user`


### `POST /contacts/import`

**Function:** `import_contacts` (line 811)

Import contacts from a CSV file. Expected columns: contact_type, first_name, last_name, company_name, email, phone, address, source, tags.

**Parameters:** `file`

**Auth:** `current_user`


### `GET /contacts/export`

**Function:** `export_contacts` (line 867)

Download all active contacts as a CSV file.

**Auth:** `current_user`


---

## crm_links.py

CRM cross-module soft links — Calendar, Meetings, Forms, E-Commerce.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/contacts/{contact_id}/schedule-followup` | `schedule_contact_followup` | — |
| `POST` | `/deals/{deal_id}/schedule-followup` | `schedule_deal_followup` | — |
| `POST` | `/contacts/{contact_id}/schedule-meeting` | `schedule_contact_meeting` | — |
| `POST` | `/deals/{deal_id}/schedule-meeting` | `schedule_deal_meeting` | — |
| `POST` | `/lead-capture-forms` | `create_lead_capture_form` | — |
| `GET` | `/lead-capture-forms` | `list_lead_capture_forms` | — |
| `POST` | `/contacts/{contact_id}/sync-ecommerce` | `sync_contact_to_ecommerce` | — |
| `POST` | `/contacts/import-from-ecommerce` | `import_from_ecommerce` | — |

### `POST /contacts/{contact_id}/schedule-followup`

**Function:** `schedule_contact_followup` (line 58)

**Parameters:** `contact_id`, `payload`

**Auth:** `current_user`


### `POST /deals/{deal_id}/schedule-followup`

**Function:** `schedule_deal_followup` (line 117)

**Parameters:** `deal_id`, `payload`

**Auth:** `current_user`


### `POST /contacts/{contact_id}/schedule-meeting`

**Function:** `schedule_contact_meeting` (line 176)

**Parameters:** `contact_id`, `payload`

**Auth:** `current_user`


### `POST /deals/{deal_id}/schedule-meeting`

**Function:** `schedule_deal_meeting` (line 253)

**Parameters:** `deal_id`, `payload`

**Auth:** `current_user`


### `POST /lead-capture-forms`

**Function:** `create_lead_capture_form` (line 329)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /lead-capture-forms`

**Function:** `list_lead_capture_forms` (line 408)

**Auth:** `current_user`


### `POST /contacts/{contact_id}/sync-ecommerce`

**Function:** `sync_contact_to_ecommerce` (line 441)

**Parameters:** `contact_id`, `payload`

**Auth:** `current_user`


### `POST /contacts/import-from-ecommerce`

**Function:** `import_from_ecommerce` (line 536)

**Parameters:** `payload`

**Auth:** `current_user`


---

## crm_marketing.py

CRM Marketing — A/B tests, segments, content calendar, unsubscribes.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/campaigns/{campaign_id}/ab-test` | `create_ab_test` | — |
| `GET` | `/campaigns/{campaign_id}/ab-test` | `get_ab_test` | — |
| `GET` | `/segments` | `list_segments` | — |
| `POST` | `/segments` | `create_segment` | — |
| `PUT` | `/segments/{segment_id}` | `update_segment` | — |
| `DELETE` | `/segments/{segment_id}` | `delete_segment` | — |
| `POST` | `/segments/{segment_id}/compute` | `compute_segment` | — |
| `POST` | `/segments/{segment_id}/contacts` | `add_segment_contacts` | — |
| `GET` | `/content-calendar` | `list_content_calendar` | — |
| `POST` | `/content-calendar` | `create_content_calendar_item` | — |
| `PUT` | `/content-calendar/{item_id}` | `update_content_calendar_item` | — |
| `DELETE` | `/content-calendar/{item_id}` | `delete_content_calendar_item` | — |
| `GET` | `/unsubscribes` | `list_unsubscribes` | — |
| `POST` | `/unsubscribes` | `create_unsubscribe` | — |

### `POST /campaigns/{campaign_id}/ab-test`

**Function:** `create_ab_test` (line 167)

**Parameters:** `campaign_id`, `payload`

**Auth:** `current_user`


### `GET /campaigns/{campaign_id}/ab-test`

**Function:** `get_ab_test` (line 204)

**Parameters:** `campaign_id`

**Auth:** `current_user`


### `GET /segments`

**Function:** `list_segments` (line 242)

**Parameters:** `segment_type`, `page`, `limit`

**Auth:** `current_user`


### `POST /segments`

**Function:** `create_segment` (line 268)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /segments/{segment_id}`

**Function:** `update_segment` (line 288)

**Parameters:** `segment_id`, `payload`

**Auth:** `current_user`


### `DELETE /segments/{segment_id}`

**Function:** `delete_segment` (line 305)

**Parameters:** `segment_id`

**Auth:** `current_user`


### `POST /segments/{segment_id}/compute`

**Function:** `compute_segment` (line 323)

**Parameters:** `segment_id`

**Auth:** `current_user`


### `POST /segments/{segment_id}/contacts`

**Function:** `add_segment_contacts` (line 407)

**Parameters:** `segment_id`, `payload`

**Auth:** `current_user`


### `GET /content-calendar`

**Function:** `list_content_calendar` (line 459)

**Parameters:** `status_filter`, `content_type`, `date_from`, `date_to`, `page`, `limit`

**Auth:** `current_user`


### `POST /content-calendar`

**Function:** `create_content_calendar_item` (line 499)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /content-calendar/{item_id}`

**Function:** `update_content_calendar_item` (line 524)

**Parameters:** `item_id`, `payload`

**Auth:** `current_user`


### `DELETE /content-calendar/{item_id}`

**Function:** `delete_content_calendar_item` (line 547)

**Parameters:** `item_id`

**Auth:** `current_user`


### `GET /unsubscribes`

**Function:** `list_unsubscribes` (line 566)

**Parameters:** `page`, `limit`

**Auth:** `current_user`


### `POST /unsubscribes`

**Function:** `create_unsubscribe` (line 593)

**Parameters:** `payload`

**Auth:** `current_user`


---

## crm_pipelines.py

CRM Pipelines — multi-pipeline CRUD + board view + what-if forecast.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/pipelines` | `list_pipelines` | — |
| `POST` | `/pipelines` | `create_pipeline` | — |
| `PUT` | `/pipelines/{pipeline_id}` | `update_pipeline` | — |
| `DELETE` | `/pipelines/{pipeline_id}` | `delete_pipeline` | — |
| `GET` | `/pipelines/{pipeline_id}/board` | `pipeline_board` | — |
| `GET` | `/pipelines/{pipeline_id}/forecast` | `pipeline_forecast` | — |

### `GET /pipelines`

**Function:** `list_pipelines` (line 52)

**Parameters:** `active_only`

**Auth:** `current_user`


### `POST /pipelines`

**Function:** `create_pipeline` (line 67)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /pipelines/{pipeline_id}`

**Function:** `update_pipeline` (line 91)

**Parameters:** `pipeline_id`, `payload`

**Auth:** `current_user`


### `DELETE /pipelines/{pipeline_id}`

**Function:** `delete_pipeline` (line 112)

**Parameters:** `pipeline_id`

**Auth:** `current_user`


### `GET /pipelines/{pipeline_id}/board`

**Function:** `pipeline_board` (line 132)

**Parameters:** `pipeline_id`, `swimlane`

**Auth:** `current_user`


### `GET /pipelines/{pipeline_id}/forecast`

**Function:** `pipeline_forecast` (line 191)

**Parameters:** `pipeline_id`, `probability_adjustment`

**Auth:** `current_user`


---

## crm_reports_v2.py

CRM reports, dashboards, and gamification endpoints.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/reports/funnel` | `pipeline_funnel_report` | Pipeline funnel: count + total expected_value grouped by stage. |
| `GET` | `/reports/cohort` | `cohort_report` | Cohort report: leads grouped by created_at month with conversion counts. |
| `GET` | `/reports/leaderboard` | `leaderboard` | Gamification leaderboard. |
| `POST` | `/reports/compute-scores` | `trigger_compute_scores` | Trigger daily gamification score computation. |
| `GET` | `/saved-reports` | `list_saved_reports` | List saved reports for current user (paginated). |
| `POST` | `/saved-reports` | `create_saved_report` | Create a saved report. |
| `PUT` | `/saved-reports/{report_id}` | `update_saved_report` | Update a saved report. |
| `DELETE` | `/saved-reports/{report_id}` | `delete_saved_report` | Delete a saved report. |
| `GET` | `/dashboard-widgets` | `list_dashboard_widgets` | List widgets for the current user, optionally filtered by dashboard_id. |
| `POST` | `/dashboard-widgets` | `create_dashboard_widget` | Create a dashboard widget. |
| `PUT` | `/dashboard-widgets/{widget_id}` | `update_dashboard_widget` | Update a dashboard widget (position, config, size). |
| `DELETE` | `/dashboard-widgets/{widget_id}` | `delete_dashboard_widget` | Delete a dashboard widget. |
| `GET` | `/gamification/my-score` | `my_gamification_scores` | Get current user's gamification scores for the last 30 days. |

### `GET /reports/funnel`

**Function:** `pipeline_funnel_report` (line 126)

Pipeline funnel: count + total expected_value grouped by stage.

**Auth:** `current_user`


### `GET /reports/cohort`

**Function:** `cohort_report` (line 153)

Cohort report: leads grouped by created_at month with conversion counts.

**Auth:** `current_user`


### `GET /reports/leaderboard`

**Function:** `leaderboard` (line 183)

Gamification leaderboard.

**Parameters:** `period`, `limit`

**Auth:** `current_user`


### `POST /reports/compute-scores`

**Function:** `trigger_compute_scores` (line 199)

Trigger daily gamification score computation.

**Auth:** `current_user`


### `GET /saved-reports`

**Function:** `list_saved_reports` (line 214)

List saved reports for current user (paginated).

**Parameters:** `report_type`, `is_favorite`, `skip`, `limit`

**Auth:** `current_user`


### `POST /saved-reports`

**Function:** `create_saved_report` (line 242)

Create a saved report.

**Parameters:** `payload`

**Response model:** `SavedReportOut`

**Auth:** `current_user`


### `PUT /saved-reports/{report_id}`

**Function:** `update_saved_report` (line 263)

Update a saved report.

**Parameters:** `report_id`, `payload`

**Response model:** `SavedReportOut`

**Auth:** `current_user`


### `DELETE /saved-reports/{report_id}`

**Function:** `delete_saved_report` (line 290)

Delete a saved report.

**Parameters:** `report_id`

**Auth:** `current_user`


### `GET /dashboard-widgets`

**Function:** `list_dashboard_widgets` (line 317)

List widgets for the current user, optionally filtered by dashboard_id.

**Parameters:** `dashboard_id`

**Auth:** `current_user`


### `POST /dashboard-widgets`

**Function:** `create_dashboard_widget` (line 340)

Create a dashboard widget.

**Parameters:** `payload`

**Response model:** `DashboardWidgetOut`

**Auth:** `current_user`


### `PUT /dashboard-widgets/{widget_id}`

**Function:** `update_dashboard_widget` (line 364)

Update a dashboard widget (position, config, size).

**Parameters:** `widget_id`, `payload`

**Response model:** `DashboardWidgetOut`

**Auth:** `current_user`


### `DELETE /dashboard-widgets/{widget_id}`

**Function:** `delete_dashboard_widget` (line 391)

Delete a dashboard widget.

**Parameters:** `widget_id`

**Auth:** `current_user`


### `GET /gamification/my-score`

**Function:** `my_gamification_scores` (line 418)

Get current user's gamification scores for the last 30 days.

**Auth:** `current_user`


---

## crm_scoring.py

CRM Lead Scoring — CRUD for scoring rules + score execution.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/scoring/rules` | `list_scoring_rules` | — |
| `POST` | `/scoring/rules` | `create_scoring_rule` | — |
| `PUT` | `/scoring/rules/{rule_id}` | `update_scoring_rule` | — |
| `DELETE` | `/scoring/rules/{rule_id}` | `delete_scoring_rule` | — |
| `POST` | `/scoring/run` | `run_batch_scoring` | — |
| `POST` | `/leads/{lead_id}/score` | `score_single_lead` | — |
| `GET` | `/scoring/weights` | `get_scoring_weights` | — |

### `GET /scoring/rules`

**Function:** `list_scoring_rules` (line 59)

**Parameters:** `category`, `active_only`

**Auth:** `current_user`


### `POST /scoring/rules`

**Function:** `create_scoring_rule` (line 77)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /scoring/rules/{rule_id}`

**Function:** `update_scoring_rule` (line 99)

**Parameters:** `rule_id`, `payload`

**Auth:** `current_user`


### `DELETE /scoring/rules/{rule_id}`

**Function:** `delete_scoring_rule` (line 116)

**Parameters:** `rule_id`

**Auth:** `current_user`


### `POST /scoring/run`

**Function:** `run_batch_scoring` (line 130)

**Auth:** `current_user`


### `POST /leads/{lead_id}/score`

**Function:** `score_single_lead` (line 140)

**Parameters:** `lead_id`

**Auth:** `current_user`


### `GET /scoring/weights`

**Function:** `get_scoring_weights` (line 153)

**Auth:** `current_user`


---

## crm_sequences.py

CRM Sales Sequences — sequence CRUD + enrollment management.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/sequences` | `list_sequences` | — |
| `POST` | `/sequences` | `create_sequence` | — |
| `GET` | `/sequences/{sequence_id}` | `get_sequence` | — |
| `PUT` | `/sequences/{sequence_id}` | `update_sequence` | — |
| `DELETE` | `/sequences/{sequence_id}` | `delete_sequence` | — |
| `POST` | `/sequences/{sequence_id}/activate` | `activate_sequence` | — |
| `POST` | `/sequences/{sequence_id}/pause` | `pause_sequence` | — |
| `POST` | `/sequences/{sequence_id}/enroll` | `enroll_contacts` | — |
| `POST` | `/sequences/{sequence_id}/unenroll/{contact_id}` | `unenroll_from_sequence` | — |
| `GET` | `/sequences/{sequence_id}/enrollments` | `list_enrollments` | — |

### `GET /sequences`

**Function:** `list_sequences` (line 91)

**Parameters:** `status_filter`, `page`, `limit`

**Auth:** `current_user`


### `POST /sequences`

**Function:** `create_sequence` (line 113)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /sequences/{sequence_id}`

**Function:** `get_sequence` (line 145)

**Parameters:** `sequence_id`

**Auth:** `current_user`


### `PUT /sequences/{sequence_id}`

**Function:** `update_sequence` (line 176)

**Parameters:** `sequence_id`, `payload`

**Auth:** `current_user`


### `DELETE /sequences/{sequence_id}`

**Function:** `delete_sequence` (line 193)

**Parameters:** `sequence_id`

**Auth:** `current_user`


### `POST /sequences/{sequence_id}/activate`

**Function:** `activate_sequence` (line 207)

**Parameters:** `sequence_id`

**Auth:** `current_user`


### `POST /sequences/{sequence_id}/pause`

**Function:** `pause_sequence` (line 221)

**Parameters:** `sequence_id`

**Auth:** `current_user`


### `POST /sequences/{sequence_id}/enroll`

**Function:** `enroll_contacts` (line 235)

**Parameters:** `sequence_id`, `payload`

**Auth:** `current_user`


### `POST /sequences/{sequence_id}/unenroll/{contact_id}`

**Function:** `unenroll_from_sequence` (line 256)

**Parameters:** `sequence_id`, `contact_id`

**Auth:** `current_user`


### `GET /sequences/{sequence_id}/enrollments`

**Function:** `list_enrollments` (line 277)

**Parameters:** `sequence_id`, `status_filter`, `page`, `limit`

**Auth:** `current_user`


---

## crm_service.py

CRM Service Hub — conversations, knowledge base, and SLA management.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/conversations` | `list_conversations` | — |
| `POST` | `/conversations` | `create_conversation` | — |
| `GET` | `/conversations/{conversation_id}` | `get_conversation` | — |
| `POST` | `/conversations/{conversation_id}/messages` | `add_message` | — |
| `PUT` | `/conversations/{conversation_id}/assign` | `assign_conversation` | — |
| `PUT` | `/conversations/{conversation_id}/resolve` | `resolve_conversation` | — |
| `GET` | `/kb/articles` | `list_kb_articles` | — |
| `POST` | `/kb/articles` | `create_kb_article` | — |
| `GET` | `/kb/articles/{article_id}` | `get_kb_article` | — |
| `PUT` | `/kb/articles/{article_id}` | `update_kb_article` | — |
| `DELETE` | `/kb/articles/{article_id}` | `delete_kb_article` | — |
| `POST` | `/kb/search` | `search_kb_articles` | — |
| `GET` | `/sla/policies` | `list_sla_policies` | — |
| `POST` | `/sla/policies` | `create_sla_policy` | — |
| `PUT` | `/sla/policies/{policy_id}` | `update_sla_policy` | — |
| `DELETE` | `/sla/policies/{policy_id}` | `delete_sla_policy` | — |
| `GET` | `/sla/tickets/{ticket_id}` | `get_sla_tracker` | — |

### `GET /conversations`

**Function:** `list_conversations` (line 201)

**Parameters:** `status_filter`, `channel`, `assigned_to`, `page`, `limit`

**Auth:** `current_user`


### `POST /conversations`

**Function:** `create_conversation` (line 233)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /conversations/{conversation_id}`

**Function:** `get_conversation` (line 254)

**Parameters:** `conversation_id`

**Auth:** `current_user`


### `POST /conversations/{conversation_id}/messages`

**Function:** `add_message` (line 279)

**Parameters:** `conversation_id`, `payload`

**Auth:** `current_user`


### `PUT /conversations/{conversation_id}/assign`

**Function:** `assign_conversation` (line 307)

**Parameters:** `conversation_id`, `payload`

**Auth:** `current_user`


### `PUT /conversations/{conversation_id}/resolve`

**Function:** `resolve_conversation` (line 327)

**Parameters:** `conversation_id`, `payload`

**Auth:** `current_user`


### `GET /kb/articles`

**Function:** `list_kb_articles` (line 348)

**Parameters:** `category`, `status_filter`, `search`, `page`, `limit`

**Auth:** `current_user`


### `POST /kb/articles`

**Function:** `create_kb_article` (line 381)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /kb/articles/{article_id}`

**Function:** `get_kb_article` (line 412)

**Parameters:** `article_id`

**Auth:** `current_user`


### `PUT /kb/articles/{article_id}`

**Function:** `update_kb_article` (line 428)

**Parameters:** `article_id`, `payload`

**Auth:** `current_user`


### `DELETE /kb/articles/{article_id}`

**Function:** `delete_kb_article` (line 456)

**Parameters:** `article_id`

**Auth:** `current_user`


### `POST /kb/search`

**Function:** `search_kb_articles` (line 470)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /sla/policies`

**Function:** `list_sla_policies` (line 485)

**Auth:** `current_user`


### `POST /sla/policies`

**Function:** `create_sla_policy` (line 499)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /sla/policies/{policy_id}`

**Function:** `update_sla_policy` (line 520)

**Parameters:** `policy_id`, `payload`

**Auth:** `current_user`


### `DELETE /sla/policies/{policy_id}`

**Function:** `delete_sla_policy` (line 539)

**Parameters:** `policy_id`

**Auth:** `current_user`


### `GET /sla/tickets/{ticket_id}`

**Function:** `get_sla_tracker` (line 553)

**Parameters:** `ticket_id`

**Auth:** `current_user`


---

## crm_templates.py

CRM Email Templates — CRUD + preview with merge fields.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/templates` | `list_templates` | — |
| `POST` | `/templates` | `create_template` | — |
| `GET` | `/templates/{template_id}` | `get_template` | — |
| `PUT` | `/templates/{template_id}` | `update_template` | — |
| `DELETE` | `/templates/{template_id}` | `delete_template` | — |
| `POST` | `/templates/{template_id}/preview` | `preview_template` | — |

### `GET /templates`

**Function:** `list_templates` (line 62)

**Parameters:** `category`, `active_only`, `page`, `limit`

**Auth:** `current_user`


### `POST /templates`

**Function:** `create_template` (line 87)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /templates/{template_id}`

**Function:** `get_template` (line 109)

**Parameters:** `template_id`

**Auth:** `current_user`


### `PUT /templates/{template_id}`

**Function:** `update_template` (line 121)

**Parameters:** `template_id`, `payload`

**Auth:** `current_user`


### `DELETE /templates/{template_id}`

**Function:** `delete_template` (line 138)

**Parameters:** `template_id`

**Auth:** `current_user`


### `POST /templates/{template_id}/preview`

**Function:** `preview_template` (line 152)

**Parameters:** `template_id`, `payload`

**Auth:** `current_user`


---

## crm_tickets.py

CRM Tickets API — CRUD for CRM support tickets.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/tickets` | `list_tickets` | — |
| `POST` | `/tickets` | `create_ticket` | — |
| `GET` | `/tickets/{ticket_id}` | `get_ticket` | — |
| `PUT` | `/tickets/{ticket_id}` | `update_ticket` | — |
| `DELETE` | `/tickets/{ticket_id}` | `delete_ticket` | — |
| `PUT` | `/tickets/{ticket_id}/assign` | `assign_ticket` | — |

### `GET /tickets`

**Function:** `list_tickets` (line 61)

**Parameters:** `status_filter`, `priority`, `assigned_to`, `search`, `page`, `limit`

**Auth:** `current_user`


### `POST /tickets`

**Function:** `create_ticket` (line 104)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /tickets/{ticket_id}`

**Function:** `get_ticket` (line 125)

**Parameters:** `ticket_id`

**Auth:** `current_user`


### `PUT /tickets/{ticket_id}`

**Function:** `update_ticket` (line 137)

**Parameters:** `ticket_id`, `payload`

**Auth:** `current_user`


### `DELETE /tickets/{ticket_id}`

**Function:** `delete_ticket` (line 164)

**Parameters:** `ticket_id`

**Auth:** `current_user`


### `PUT /tickets/{ticket_id}/assign`

**Function:** `assign_ticket` (line 178)

**Parameters:** `ticket_id`, `payload`

**Auth:** `current_user`


---

## crm_workflows.py

CRM Workflow Automation — workflow CRUD, node management, execution & templates.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/workflows` | `list_workflows` | List workflows with optional status and trigger_type filters. |
| `POST` | `/workflows` | `create_workflow` | Create a workflow with an initial trigger node. |
| `GET` | `/workflows/{workflow_id}` | `get_workflow` | Get a single workflow with all its nodes. |
| `PUT` | `/workflows/{workflow_id}` | `update_workflow` | Update workflow metadata. |
| `DELETE` | `/workflows/{workflow_id}` | `delete_workflow` | Delete a workflow and cascade-delete its nodes and executions. |
| `POST` | `/workflows/{workflow_id}/nodes` | `add_node` | Add a node to a workflow. |
| `PUT` | `/workflows/{workflow_id}/nodes/{node_id}` | `update_node` | Update a workflow node. |
| `DELETE` | `/workflows/{workflow_id}/nodes/{node_id}` | `delete_node` | Delete a workflow node. |
| `POST` | `/workflows/{workflow_id}/activate` | `activate_workflow` | Set workflow status to active. |
| `POST` | `/workflows/{workflow_id}/pause` | `pause_workflow` | Set workflow status to paused. |
| `POST` | `/workflows/{workflow_id}/test` | `test_execute_workflow` | Test-execute a workflow with sample trigger data. |
| `GET` | `/workflows/{workflow_id}/executions` | `list_executions` | List executions for a workflow. |
| `GET` | `/workflow-templates` | `list_templates` | List workflow templates, optionally filtered by category. |
| `POST` | `/workflow-templates/{template_id}/clone` | `clone_template` | Clone a template into a new workflow with its nodes. |

### `GET /workflows`

**Function:** `list_workflows` (line 134)

List workflows with optional status and trigger_type filters.

**Parameters:** `status_filter`, `trigger_type`, `skip`, `limit`

**Response model:** `dict`

**Auth:** `current_user`


### `POST /workflows`

**Function:** `create_workflow` (line 159)

Create a workflow with an initial trigger node.

**Parameters:** `payload`

**Response model:** `WorkflowDetailOut`

**Auth:** `current_user`


### `GET /workflows/{workflow_id}`

**Function:** `get_workflow` (line 191)

Get a single workflow with all its nodes.

**Parameters:** `workflow_id`

**Response model:** `WorkflowDetailOut`

**Auth:** `current_user`


### `PUT /workflows/{workflow_id}`

**Function:** `update_workflow` (line 209)

Update workflow metadata.

**Parameters:** `workflow_id`, `payload`

**Response model:** `WorkflowOut`

**Auth:** `current_user`


### `DELETE /workflows/{workflow_id}`

**Function:** `delete_workflow` (line 225)

Delete a workflow and cascade-delete its nodes and executions.

**Parameters:** `workflow_id`

**Auth:** `current_user`


### `POST /workflows/{workflow_id}/nodes`

**Function:** `add_node` (line 247)

Add a node to a workflow.

**Parameters:** `workflow_id`, `payload`

**Response model:** `NodeOut`

**Auth:** `current_user`


### `PUT /workflows/{workflow_id}/nodes/{node_id}`

**Function:** `update_node` (line 272)

Update a workflow node.

**Parameters:** `workflow_id`, `node_id`, `payload`

**Response model:** `NodeOut`

**Auth:** `current_user`


### `DELETE /workflows/{workflow_id}/nodes/{node_id}`

**Function:** `delete_node` (line 300)

Delete a workflow node.

**Parameters:** `workflow_id`, `node_id`

**Auth:** `current_user`


### `POST /workflows/{workflow_id}/activate`

**Function:** `activate_workflow` (line 325)

Set workflow status to active.

**Parameters:** `workflow_id`

**Response model:** `WorkflowOut`

**Auth:** `current_user`


### `POST /workflows/{workflow_id}/pause`

**Function:** `pause_workflow` (line 341)

Set workflow status to paused.

**Parameters:** `workflow_id`

**Response model:** `WorkflowOut`

**Auth:** `current_user`


### `POST /workflows/{workflow_id}/test`

**Function:** `test_execute_workflow` (line 357)

Test-execute a workflow with sample trigger data.

**Parameters:** `workflow_id`, `payload`

**Response model:** `ExecutionOut`

**Auth:** `current_user`


### `GET /workflows/{workflow_id}/executions`

**Function:** `list_executions` (line 375)

List executions for a workflow.

**Parameters:** `workflow_id`, `skip`, `limit`

**Response model:** `dict`

**Auth:** `current_user`


### `GET /workflow-templates`

**Function:** `list_templates` (line 407)

List workflow templates, optionally filtered by category.

**Parameters:** `category`

**Auth:** `current_user`


### `POST /workflow-templates/{template_id}/clone`

**Function:** `clone_template` (line 426)

Clone a template into a new workflow with its nodes.

**Parameters:** `template_id`

**Response model:** `WorkflowDetailOut`

**Auth:** `current_user`

