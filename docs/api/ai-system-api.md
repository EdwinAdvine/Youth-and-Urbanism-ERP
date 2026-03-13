# AI System — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 51


## Contents

- [agent.py](#agent) (4 endpoints)
- [ai.py](#ai) (3 endpoints)
- [ai_ext.py](#ai-ext) (14 endpoints)
- [ai_features.py](#ai-features) (30 endpoints)

---

## agent.py

Urban Bad AI — WebSocket + REST endpoints for multi-agent orchestration.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/runs` | `list_runs` | — |
| `GET` | `/runs/{run_id}` | `get_run` | — |
| `POST` | `/runs/{run_id}/approve` | `approve_run` | — |
| `GET` | `/approvals/pending` | `list_pending_approvals` | — |

### `GET /runs`

**Function:** `list_runs` (line 133)

**Parameters:** `skip`, `limit`

**Auth:** `current_user`


### `GET /runs/{run_id}`

**Function:** `get_run` (line 152)

**Parameters:** `run_id`

**Response model:** `AgentRunOut`

**Auth:** `current_user`


### `POST /runs/{run_id}/approve`

**Function:** `approve_run` (line 170)

**Parameters:** `run_id`, `payload`

**Response model:** `AgentRunOut`

**Auth:** `current_user`


### `GET /approvals/pending`

**Function:** `list_pending_approvals` (line 197)

**Auth:** `current_user`


---

## ai.py


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/chat` | `chat` | — |
| `GET` | `/history/{session_id}` | `get_history` | — |
| `GET` | `/sessions` | `list_sessions` | — |

### `POST /chat`

**Function:** `chat` (line 30)

**Parameters:** `request`, `payload`

**Response model:** `ChatResponse`

**Auth:** `current_user`


### `GET /history/{session_id}`

**Function:** `get_history` (line 58)

**Parameters:** `session_id`

**Auth:** `current_user`


### `GET /sessions`

**Function:** `list_sessions` (line 73)

**Auth:** `current_user`


---

## ai_ext.py

AI extensions — prompt templates, knowledge base, usage stats, conversations.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/templates` | `list_templates` | — |
| `POST` | `/templates` | `create_template` | — |
| `GET` | `/templates/{template_id}` | `get_template` | — |
| `PUT` | `/templates/{template_id}` | `update_template` | — |
| `DELETE` | `/templates/{template_id}` | `delete_template` | — |
| `GET` | `/knowledge-bases` | `list_knowledge_bases` | — |
| `POST` | `/knowledge-bases` | `create_knowledge_base` | — |
| `GET` | `/knowledge-bases/{kb_id}` | `get_knowledge_base` | — |
| `PUT` | `/knowledge-bases/{kb_id}` | `update_knowledge_base` | — |
| `DELETE` | `/knowledge-bases/{kb_id}` | `delete_knowledge_base` | — |
| `POST` | `/knowledge-bases/{kb_id}/upload` | `upload_to_knowledge_base` | — |
| `GET` | `/usage` | `usage_stats` | — |
| `GET` | `/conversations` | `list_conversations` | — |
| `GET` | `/conversations/{conversation_id}/messages` | `get_conversation_messages` | — |

### `GET /templates`

**Function:** `list_templates` (line 116)

**Parameters:** `module`

**Auth:** `current_user`


### `POST /templates`

**Function:** `create_template` (line 142)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /templates/{template_id}`

**Function:** `get_template` (line 169)

**Parameters:** `template_id`

**Auth:** `current_user`


### `PUT /templates/{template_id}`

**Function:** `update_template` (line 183)

**Parameters:** `template_id`, `payload`

**Auth:** `current_user`


### `DELETE /templates/{template_id}`

**Function:** `delete_template` (line 213)

**Parameters:** `template_id`

**Auth:** `current_user`


### `GET /knowledge-bases`

**Function:** `list_knowledge_bases` (line 229)

**Parameters:** `module`

**Auth:** `current_user`


### `POST /knowledge-bases`

**Function:** `create_knowledge_base` (line 248)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /knowledge-bases/{kb_id}`

**Function:** `get_knowledge_base` (line 267)

**Parameters:** `kb_id`

**Auth:** `current_user`


### `PUT /knowledge-bases/{kb_id}`

**Function:** `update_knowledge_base` (line 279)

**Parameters:** `kb_id`, `payload`

**Auth:** `current_user`


### `DELETE /knowledge-bases/{kb_id}`

**Function:** `delete_knowledge_base` (line 298)

**Parameters:** `kb_id`

**Auth:** `current_user`


### `POST /knowledge-bases/{kb_id}/upload`

**Function:** `upload_to_knowledge_base` (line 311)

**Parameters:** `kb_id`, `file`

**Auth:** `current_user`


### `GET /usage`

**Function:** `usage_stats` (line 358)

**Parameters:** `period`, `days`

**Auth:** `current_user`


### `GET /conversations`

**Function:** `list_conversations` (line 456)

**Parameters:** `page`, `limit`

**Auth:** `current_user`


### `GET /conversations/{conversation_id}/messages`

**Function:** `get_conversation_messages` (line 516)

**Parameters:** `conversation_id`

**Auth:** `current_user`


---

## ai_features.py

AI-powered feature endpoints — lead scoring, ticket classification, demand forecasting, etc.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/crm/leads/{lead_id}/ai-score` | `ai_score_lead` | — |
| `POST` | `/crm/deals/{deal_id}/ai-next-action` | `ai_next_action_deal` | — |
| `POST` | `/crm/contacts/{contact_id}/ai-next-action` | `ai_next_action_contact` | — |
| `POST` | `/crm/opportunities/{opp_id}/ai-next-action` | `ai_next_action_opportunity` | — |
| `POST` | `/support/tickets/{ticket_id}/ai-classify` | `ai_classify_ticket` | — |
| `POST` | `/support/tickets/{ticket_id}/ai-suggest-reply` | `ai_suggest_reply` | — |
| `POST` | `/support/tickets/{ticket_id}/ai-generate-kb` | `ai_generate_kb` | — |
| `POST` | `/inventory/items/{item_id}/ai-demand-forecast` | `ai_demand_forecast` | — |
| `POST` | `/inventory/items/{item_id}/ai-reorder-optimize` | `ai_reorder_optimize` | — |
| `POST` | `/ai/summarize-meeting` | `ai_summarize_meeting` | — |
| `POST` | `/ai/check-availability` | `ai_check_availability` | — |
| `POST` | `/ai/schedule-meeting` | `ai_schedule_meeting` | — |
| `POST` | `/ai/compose-email` | `ai_compose_email` | — |
| `POST` | `/ai/estimate-task` | `ai_estimate_task` | — |
| `POST` | `/ai/generate-report` | `ai_generate_report` | — |
| `POST` | `/ai/query-data` | `ai_query_data` | — |
| `POST` | `/hr/employees/{employee_id}/ai-attrition-risk` | `ai_attrition_risk` | — |
| `POST` | `/hr/payroll/ai-anomaly-check` | `ai_payroll_anomaly_check` | — |
| `POST` | `/supply-chain/ai-recommend-supplier` | `ai_recommend_supplier` | — |
| `POST` | `/manufacturing/ai-optimize-production` | `ai_optimize_production` | — |
| `POST` | `/manufacturing/workstations/{workstation_id}/ai-predict-maintenance` | `ai_predict_maintenance` | — |
| `POST` | `/ecommerce/ai-recommend-products` | `ai_recommend_products` | — |
| `POST` | `/ecommerce/products/{product_id}/ai-optimize-price` | `ai_optimize_pricing` | — |
| `POST` | `/projects/{project_id}/ai-risk-analysis` | `ai_project_risk_analysis` | — |
| `POST` | `/mail/threads/{thread_id}/ai-summarize` | `ai_summarize_email_thread` | — |
| `POST` | `/mail/messages/{message_id}/ai-categorize` | `ai_categorize_email` | — |
| `POST` | `/notes/{note_id}/ai-auto-tag` | `ai_auto_tag_note` | — |
| `POST` | `/forms/ai-generate` | `ai_generate_form` | — |
| `POST` | `/docs/{doc_id}/ai-translate` | `ai_translate_document` | — |
| `POST` | `/drive/ai-organize-suggestions` | `ai_organize_suggestions` | — |

### `POST /crm/leads/{lead_id}/ai-score`

**Function:** `ai_score_lead` (line 316)

**Parameters:** `lead_id`

**Response model:** `AIScoreResponse`

**Auth:** `current_user`


### `POST /crm/deals/{deal_id}/ai-next-action`

**Function:** `ai_next_action_deal` (line 336)

**Parameters:** `deal_id`

**Response model:** `AINextBestActionResponse`

**Auth:** `current_user`


### `POST /crm/contacts/{contact_id}/ai-next-action`

**Function:** `ai_next_action_contact` (line 354)

**Parameters:** `contact_id`

**Response model:** `AINextBestActionResponse`

**Auth:** `current_user`


### `POST /crm/opportunities/{opp_id}/ai-next-action`

**Function:** `ai_next_action_opportunity` (line 372)

**Parameters:** `opp_id`

**Response model:** `AINextBestActionResponse`

**Auth:** `current_user`


### `POST /support/tickets/{ticket_id}/ai-classify`

**Function:** `ai_classify_ticket` (line 392)

**Parameters:** `ticket_id`

**Response model:** `AIClassifyResponse`

**Auth:** `current_user`


### `POST /support/tickets/{ticket_id}/ai-suggest-reply`

**Function:** `ai_suggest_reply` (line 412)

**Parameters:** `ticket_id`

**Response model:** `AISuggestReplyResponse`

**Auth:** `current_user`


### `POST /support/tickets/{ticket_id}/ai-generate-kb`

**Function:** `ai_generate_kb` (line 432)

**Parameters:** `ticket_id`

**Response model:** `AIKBGenerateResponse`

**Auth:** `current_user`


### `POST /inventory/items/{item_id}/ai-demand-forecast`

**Function:** `ai_demand_forecast` (line 455)

**Parameters:** `item_id`, `periods_ahead`

**Response model:** `AIDemandForecastResponse`

**Auth:** `current_user`


### `POST /inventory/items/{item_id}/ai-reorder-optimize`

**Function:** `ai_reorder_optimize` (line 476)

**Parameters:** `item_id`

**Response model:** `AIReorderOptimizeResponse`

**Auth:** `current_user`


### `POST /ai/summarize-meeting`

**Function:** `ai_summarize_meeting` (line 496)

**Parameters:** `payload`

**Response model:** `AIMeetingSummaryResponse`

**Auth:** `current_user`


### `POST /ai/check-availability`

**Function:** `ai_check_availability` (line 516)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /ai/schedule-meeting`

**Function:** `ai_schedule_meeting` (line 536)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /ai/compose-email`

**Function:** `ai_compose_email` (line 563)

**Parameters:** `payload`

**Response model:** `AIComposeEmailResponse`

**Auth:** `current_user`


### `POST /ai/estimate-task`

**Function:** `ai_estimate_task` (line 584)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /ai/generate-report`

**Function:** `ai_generate_report` (line 604)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /ai/query-data`

**Function:** `ai_query_data` (line 624)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /hr/employees/{employee_id}/ai-attrition-risk`

**Function:** `ai_attrition_risk` (line 644)

**Parameters:** `employee_id`

**Response model:** `AIAttritionRiskResponse`

**Auth:** `current_user`


### `POST /hr/payroll/ai-anomaly-check`

**Function:** `ai_payroll_anomaly_check` (line 664)

**Parameters:** `months_back`

**Response model:** `AIPayrollAnomalyResponse`

**Auth:** `current_user`


### `POST /supply-chain/ai-recommend-supplier`

**Function:** `ai_recommend_supplier` (line 682)

**Parameters:** `payload`

**Response model:** `AISupplierRecommendationResponse`

**Auth:** `current_user`


### `POST /manufacturing/ai-optimize-production`

**Function:** `ai_optimize_production` (line 707)

**Response model:** `AIProductionOptimizationResponse`

**Auth:** `current_user`


### `POST /manufacturing/workstations/{workstation_id}/ai-predict-maintenance`

**Function:** `ai_predict_maintenance` (line 724)

**Parameters:** `workstation_id`

**Response model:** `AIPredictiveMaintenanceResponse`

**Auth:** `current_user`


### `POST /ecommerce/ai-recommend-products`

**Function:** `ai_recommend_products` (line 744)

**Parameters:** `payload`

**Response model:** `AIProductRecommendationResponse`

**Auth:** `current_user`


### `POST /ecommerce/products/{product_id}/ai-optimize-price`

**Function:** `ai_optimize_pricing` (line 769)

**Parameters:** `product_id`

**Response model:** `AIPricingOptimizationResponse`

**Auth:** `current_user`


### `POST /projects/{project_id}/ai-risk-analysis`

**Function:** `ai_project_risk_analysis` (line 789)

**Parameters:** `project_id`

**Response model:** `AIProjectRiskResponse`

**Auth:** `current_user`


### `POST /mail/threads/{thread_id}/ai-summarize`

**Function:** `ai_summarize_email_thread` (line 809)

**Parameters:** `thread_id`

**Response model:** `AIThreadSummaryResponse`

**Auth:** `current_user`


### `POST /mail/messages/{message_id}/ai-categorize`

**Function:** `ai_categorize_email` (line 829)

**Parameters:** `message_id`

**Response model:** `AIEmailCategoryResponse`

**Auth:** `current_user`


### `POST /notes/{note_id}/ai-auto-tag`

**Function:** `ai_auto_tag_note` (line 849)

**Parameters:** `note_id`

**Response model:** `AIAutoTagResponse`

**Auth:** `current_user`


### `POST /forms/ai-generate`

**Function:** `ai_generate_form` (line 869)

**Parameters:** `payload`

**Response model:** `AIFormGenerateResponse`

**Auth:** `current_user`


### `POST /docs/{doc_id}/ai-translate`

**Function:** `ai_translate_document` (line 890)

**Parameters:** `doc_id`, `payload`

**Response model:** `AITranslateResponse`

**Auth:** `current_user`


### `POST /drive/ai-organize-suggestions`

**Function:** `ai_organize_suggestions` (line 914)

**Parameters:** `include_shared`

**Response model:** `AIFileOrganizeResponse`

**Auth:** `current_user`

