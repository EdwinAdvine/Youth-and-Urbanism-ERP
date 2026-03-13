# Forms — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 59


## Contents

- [forms.py](#forms) (9 endpoints)
- [forms_ext.py](#forms-ext) (50 endpoints)

---

## forms.py

Forms API — CRUD for forms, fields, and responses with 30+ field types.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `list_forms` | — |
| `POST` | `` | `create_form` | — |
| `GET` | `/{form_id}` | `get_form` | — |
| `PUT` | `/{form_id}` | `update_form` | — |
| `DELETE` | `/{form_id}` | `delete_form` | — |
| `POST` | `/{form_id}/fields` | `bulk_update_fields` | — |
| `POST` | `/{form_id}/responses` | `submit_response` | — |
| `GET` | `/{form_id}/responses` | `list_responses` | — |
| `GET` | `/{form_id}/export` | `export_responses` | — |

### `GET `

**Function:** `list_forms` (line 140)

**Parameters:** `page`, `limit`

**Auth:** `current_user`


### `POST `

**Function:** `create_form` (line 166)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /{form_id}`

**Function:** `get_form` (line 226)

**Parameters:** `form_id`

**Auth:** `current_user`


### `PUT /{form_id}`

**Function:** `update_form` (line 249)

**Parameters:** `form_id`, `payload`

**Auth:** `current_user`


### `DELETE /{form_id}`

**Function:** `delete_form` (line 268)

**Parameters:** `form_id`

**Auth:** `current_user`


### `POST /{form_id}/fields`

**Function:** `bulk_update_fields` (line 282)

**Parameters:** `form_id`, `payload`

**Auth:** `current_user`


### `POST /{form_id}/responses`

**Function:** `submit_response` (line 441)

**Parameters:** `form_id`, `payload`

**Auth:** `current_user`


### `GET /{form_id}/responses`

**Function:** `list_responses` (line 548)

**Parameters:** `form_id`, `page`, `limit`, `include_sandbox`

**Auth:** `current_user`


### `GET /{form_id}/export`

**Function:** `export_responses` (line 588)

**Parameters:** `form_id`, `format`

**Auth:** `current_user`


---

## forms_ext.py

Forms extensions — analytics, templates, versioning, webhooks, ERP integrations, AI generation.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/forms/{form_id}/analytics` | `form_analytics` | — |
| `POST` | `/forms/{form_id}/duplicate` | `duplicate_form` | — |
| `PUT` | `/forms/{form_id}/publish` | `toggle_publish` | — |
| `POST` | `/forms/{form_id}/share` | `share_form` | — |
| `GET` | `/templates` | `list_templates` | — |
| `POST` | `/from-template/{template_id}` | `create_from_template` | — |
| `GET` | `/forms/{form_id}/versions` | `list_versions` | — |
| `POST` | `/forms/{form_id}/versions` | `create_version` | — |
| `POST` | `/forms/{form_id}/restore/{version_id}` | `restore_version` | — |
| `GET` | `/forms/{form_id}/webhooks` | `list_webhooks` | — |
| `POST` | `/forms/{form_id}/webhooks` | `create_webhook` | — |
| `DELETE` | `/forms/{form_id}/webhooks/{webhook_id}` | `delete_webhook` | — |
| `GET` | `/forms/{form_id}/audit-log` | `get_audit_log` | — |
| `PUT` | `/forms/{form_id}/logic-rules` | `update_logic_rules` | — |
| `PUT` | `/forms/{form_id}/theme` | `update_theme` | — |
| `POST` | `/forms/ai-generate` | `ai_generate_form` | — |
| `POST` | `/forms/{form_id}/create-invoice-from-response` | `create_invoice_from_response` | — |
| `POST` | `/forms/{form_id}/create-ticket-from-response` | `create_ticket_from_response` | — |
| `POST` | `/forms/{form_id}/create-event-from-response` | `create_event_from_response` | — |
| `POST` | `/forms/{form_id}/create-leave-request` | `create_leave_request` | — |
| `POST` | `/forms/{form_id}/create-po-from-response` | `create_po_from_response` | — |
| `POST` | `/forms/{form_id}/create-task-from-response` | `create_task_from_response` | — |
| `POST` | `/{form_id}/responses/draft` | `save_draft` | Save an offline draft response (not yet submitted). |
| `POST` | `/{form_id}/responses/bulk-sync` | `bulk_sync_drafts` | Bulk sync offline drafts — convert each to a real FormResponse. |
| `GET` | `/{form_id}/quiz-results` | `get_quiz_results` | List all quiz results for a form. |
| `POST` | `/{form_id}/quiz-results/grade` | `grade_quiz_response` | Grade a quiz response. Computes score from FormFieldOption.is_correct marks. |
| `POST` | `/{form_id}/schedule` | `create_schedule` | — |
| `GET` | `/{form_id}/schedule` | `get_schedule` | — |
| `DELETE` | `/{form_id}/schedule` | `delete_schedule` | — |
| `POST` | `/{form_id}/ai-analyze-responses` | `ai_analyze_responses` | Use AI to generate a summary of all form responses. |
| `GET` | `/{form_id}/analytics/cross-tab` | `cross_tab_analytics` | Cross-tabulation of two fields. |
| `GET` | `/{form_id}/analytics/funnel` | `funnel_analytics` | Page-by-page drop-off funnel analysis. |
| `POST` | `/{form_id}/approval-workflow` | `create_approval_workflow` | — |
| `GET` | `/{form_id}/approval-workflow` | `get_approval_workflow` | — |
| `POST` | `/responses/{response_id}/approve` | `approve_response` | — |
| `GET` | `/{form_id}/approval-queue` | `get_approval_queue` | — |
| `GET` | `/{form_id}/translations` | `get_translations` | — |
| `POST` | `/{form_id}/translations` | `create_translation` | — |
| `POST` | `/{form_id}/translations/ai-generate` | `ai_generate_translations` | Auto-translate form fields to the given locale using AI. |
| `POST` | `/{form_id}/consent` | `configure_consent` | — |
| `GET` | `/{form_id}/consent` | `get_consent_config` | — |
| `POST` | `/{form_id}/consent/record` | `record_consent` | — |
| `POST` | `/{form_id}/automations` | `create_automation` | — |
| `GET` | `/{form_id}/automations` | `list_automations` | — |
| `DELETE` | `/{form_id}/automations/{auto_id}` | `delete_automation` | — |
| `GET` | `/public/{share_token}` | `get_public_form` | Unauthenticated form access by share token stored in settings. |
| `POST` | `/{form_id}/ai-suggest-improvements` | `ai_suggest_improvements` | AI-powered form quality audit: clarity, completion likelihood, bias, accessib... |
| `POST` | `/{form_id}/media-upload` | `upload_form_media` | Upload media (photo/video/audio/document) attached to a form response. |
| `PUT` | `/{form_id}/embed-config` | `save_embed_config` | Save embed configuration (allowed domains, iframe height, hide header, etc.). |
| `GET` | `/{form_id}/embed-config` | `get_embed_config` | Get embed configuration for a form. |

### `GET /forms/{form_id}/analytics`

**Function:** `form_analytics` (line 258)

**Parameters:** `form_id`

**Auth:** `current_user`


### `POST /forms/{form_id}/duplicate`

**Function:** `duplicate_form` (line 365)

**Parameters:** `form_id`

**Auth:** `current_user`


### `PUT /forms/{form_id}/publish`

**Function:** `toggle_publish` (line 434)

**Parameters:** `form_id`

**Auth:** `current_user`


### `POST /forms/{form_id}/share`

**Function:** `share_form` (line 486)

**Parameters:** `form_id`, `payload`

**Auth:** `current_user`


### `GET /templates`

**Function:** `list_templates` (line 519)

**Parameters:** `category`

**Auth:** `current_user`


### `POST /from-template/{template_id}`

**Function:** `create_from_template` (line 536)

**Parameters:** `template_id`

**Auth:** `current_user`


### `GET /forms/{form_id}/versions`

**Function:** `list_versions` (line 594)

**Parameters:** `form_id`

**Auth:** `current_user`


### `POST /forms/{form_id}/versions`

**Function:** `create_version` (line 614)

**Parameters:** `form_id`

**Auth:** `current_user`


### `POST /forms/{form_id}/restore/{version_id}`

**Function:** `restore_version` (line 640)

**Parameters:** `form_id`, `version_id`

**Auth:** `current_user`


### `GET /forms/{form_id}/webhooks`

**Function:** `list_webhooks` (line 715)

**Parameters:** `form_id`

**Auth:** `current_user`


### `POST /forms/{form_id}/webhooks`

**Function:** `create_webhook` (line 733)

**Parameters:** `form_id`, `payload`

**Auth:** `current_user`


### `DELETE /forms/{form_id}/webhooks/{webhook_id}`

**Function:** `delete_webhook` (line 755)

**Parameters:** `form_id`, `webhook_id`

**Auth:** `current_user`


### `GET /forms/{form_id}/audit-log`

**Function:** `get_audit_log` (line 774)

**Parameters:** `form_id`, `limit`

**Auth:** `current_user`


### `PUT /forms/{form_id}/logic-rules`

**Function:** `update_logic_rules` (line 808)

**Parameters:** `form_id`, `payload`

**Auth:** `current_user`


### `PUT /forms/{form_id}/theme`

**Function:** `update_theme` (line 823)

**Parameters:** `form_id`, `payload`

**Auth:** `current_user`


### `POST /forms/ai-generate`

**Function:** `ai_generate_form` (line 842)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /forms/{form_id}/create-invoice-from-response`

**Function:** `create_invoice_from_response` (line 947)

**Parameters:** `form_id`, `payload`

**Auth:** `current_user`


### `POST /forms/{form_id}/create-ticket-from-response`

**Function:** `create_ticket_from_response` (line 1011)

**Parameters:** `form_id`, `payload`

**Auth:** `current_user`


### `POST /forms/{form_id}/create-event-from-response`

**Function:** `create_event_from_response` (line 1070)

**Parameters:** `form_id`, `payload`

**Auth:** `current_user`


### `POST /forms/{form_id}/create-leave-request`

**Function:** `create_leave_request` (line 1124)

**Parameters:** `form_id`, `payload`

**Auth:** `current_user`


### `POST /forms/{form_id}/create-po-from-response`

**Function:** `create_po_from_response` (line 1175)

**Parameters:** `form_id`, `payload`

**Auth:** `current_user`


### `POST /forms/{form_id}/create-task-from-response`

**Function:** `create_task_from_response` (line 1232)

**Parameters:** `form_id`, `payload`

**Auth:** `current_user`


### `POST /{form_id}/responses/draft`

**Function:** `save_draft` (line 1359)

Save an offline draft response (not yet submitted).

**Parameters:** `form_id`, `payload`

**Auth:** `user`


### `POST /{form_id}/responses/bulk-sync`

**Function:** `bulk_sync_drafts` (line 1378)

Bulk sync offline drafts — convert each to a real FormResponse.

**Parameters:** `form_id`, `payload`

**Auth:** `user`


### `GET /{form_id}/quiz-results`

**Function:** `get_quiz_results` (line 1403)

List all quiz results for a form.

**Parameters:** `form_id`

**Auth:** `user`


### `POST /{form_id}/quiz-results/grade`

**Function:** `grade_quiz_response` (line 1427)

Grade a quiz response. Computes score from FormFieldOption.is_correct marks.

**Parameters:** `form_id`, `payload`

**Auth:** `user`


### `POST /{form_id}/schedule`

**Function:** `create_schedule` (line 1480)

**Parameters:** `form_id`, `payload`

**Auth:** `user`


### `GET /{form_id}/schedule`

**Function:** `get_schedule` (line 1498)

**Parameters:** `form_id`

**Auth:** `user`


### `DELETE /{form_id}/schedule`

**Function:** `delete_schedule` (line 1507)

**Parameters:** `form_id`

**Auth:** `user`


### `POST /{form_id}/ai-analyze-responses`

**Function:** `ai_analyze_responses` (line 1521)

Use AI to generate a summary of all form responses.

**Parameters:** `form_id`

**Auth:** `user`


### `GET /{form_id}/analytics/cross-tab`

**Function:** `cross_tab_analytics` (line 1544)

Cross-tabulation of two fields.

**Parameters:** `form_id`, `row_field_id`, `col_field_id`

**Auth:** `user`


### `GET /{form_id}/analytics/funnel`

**Function:** `funnel_analytics` (line 1567)

Page-by-page drop-off funnel analysis.

**Parameters:** `form_id`

**Auth:** `user`


### `POST /{form_id}/approval-workflow`

**Function:** `create_approval_workflow` (line 1601)

**Parameters:** `form_id`, `payload`

**Auth:** `user`


### `GET /{form_id}/approval-workflow`

**Function:** `get_approval_workflow` (line 1613)

**Parameters:** `form_id`

**Auth:** `user`


### `POST /responses/{response_id}/approve`

**Function:** `approve_response` (line 1622)

**Parameters:** `response_id`, `payload`

**Auth:** `user`


### `GET /{form_id}/approval-queue`

**Function:** `get_approval_queue` (line 1639)

**Parameters:** `form_id`

**Auth:** `user`


### `GET /{form_id}/translations`

**Function:** `get_translations` (line 1662)

**Parameters:** `form_id`

**Auth:** `user`


### `POST /{form_id}/translations`

**Function:** `create_translation` (line 1669)

**Parameters:** `form_id`, `payload`

**Auth:** `user`


### `POST /{form_id}/translations/ai-generate`

**Function:** `ai_generate_translations` (line 1686)

Auto-translate form fields to the given locale using AI.

**Parameters:** `form_id`, `locale`

**Auth:** `user`


### `POST /{form_id}/consent`

**Function:** `configure_consent` (line 1723)

**Parameters:** `form_id`, `payload`

**Auth:** `user`


### `GET /{form_id}/consent`

**Function:** `get_consent_config` (line 1743)

**Parameters:** `form_id`


### `POST /{form_id}/consent/record`

**Function:** `record_consent` (line 1754)

**Parameters:** `form_id`, `payload`


### `POST /{form_id}/automations`

**Function:** `create_automation` (line 1766)

**Parameters:** `form_id`, `payload`

**Auth:** `user`


### `GET /{form_id}/automations`

**Function:** `list_automations` (line 1778)

**Parameters:** `form_id`

**Auth:** `user`


### `DELETE /{form_id}/automations/{auto_id}`

**Function:** `delete_automation` (line 1785)

**Parameters:** `form_id`, `auto_id`

**Auth:** `user`


### `GET /public/{share_token}`

**Function:** `get_public_form` (line 1799)

Unauthenticated form access by share token stored in settings.

**Parameters:** `share_token`


### `POST /{form_id}/ai-suggest-improvements`

**Function:** `ai_suggest_improvements` (line 1834)

AI-powered form quality audit: clarity, completion likelihood, bias, accessibility.

**Parameters:** `form_id`

**Auth:** `user`


### `POST /{form_id}/media-upload`

**Function:** `upload_form_media` (line 1871)

Upload media (photo/video/audio/document) attached to a form response.

**Parameters:** `form_id`, `file`

**Auth:** `user`


### `PUT /{form_id}/embed-config`

**Function:** `save_embed_config` (line 1899)

Save embed configuration (allowed domains, iframe height, hide header, etc.).

**Parameters:** `form_id`, `payload`

**Auth:** `user`


### `GET /{form_id}/embed-config`

**Function:** `get_embed_config` (line 1912)

Get embed configuration for a form.

**Parameters:** `form_id`

**Auth:** `user`

