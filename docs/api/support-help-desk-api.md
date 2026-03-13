# Support & Help Desk — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 176


## Contents

- [support.py](#support) (34 endpoints)
- [support_analytics_adv.py](#support-analytics-adv) (9 endpoints)
- [support_audit.py](#support-audit) (2 endpoints)
- [support_automation.py](#support-automation) (9 endpoints)
- [support_ext.py](#support-ext) (18 endpoints)
- [support_forum.py](#support-forum) (14 endpoints)
- [support_inbound.py](#support-inbound) (4 endpoints)
- [support_livechat.py](#support-livechat) (8 endpoints)
- [support_omnichannel.py](#support-omnichannel) (9 endpoints)
- [support_portal.py](#support-portal) (11 endpoints)
- [support_presence.py](#support-presence) (5 endpoints)
- [support_proactive.py](#support-proactive) (8 endpoints)
- [support_sandbox.py](#support-sandbox) (8 endpoints)
- [support_skills.py](#support-skills) (12 endpoints)
- [support_templates.py](#support-templates) (5 endpoints)
- [support_time.py](#support-time) (6 endpoints)
- [support_views.py](#support-views) (5 endpoints)
- [support_voice.py](#support-voice) (9 endpoints)

---

## support.py

Support / Customer Center API — tickets, comments, KB, SLA, dashboard.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/categories` | `list_categories` | — |
| `POST` | `/categories` | `create_category` | — |
| `PUT` | `/categories/{category_id}` | `update_category` | — |
| `DELETE` | `/categories/{category_id}` | `delete_category` | — |
| `GET` | `/tickets` | `list_tickets` | — |
| `POST` | `/tickets` | `create_ticket` | — |
| `GET` | `/tickets/export` | `export_tickets` | — |
| `GET` | `/tickets/{ticket_id}` | `get_ticket` | — |
| `PUT` | `/tickets/{ticket_id}` | `update_ticket` | — |
| `POST` | `/tickets/{ticket_id}/assign` | `assign_ticket` | — |
| `POST` | `/tickets/{ticket_id}/resolve` | `resolve_ticket` | — |
| `POST` | `/tickets/{ticket_id}/close` | `close_ticket` | — |
| `POST` | `/tickets/{ticket_id}/reopen` | `reopen_ticket` | — |
| `GET` | `/tickets/{ticket_id}/comments` | `list_comments` | — |
| `POST` | `/tickets/{ticket_id}/comments` | `add_comment` | — |
| `GET` | `/kb` | `list_kb_articles` | — |
| `GET` | `/kb/{slug}` | `get_kb_article` | — |
| `POST` | `/kb` | `create_kb_article` | — |
| `PUT` | `/kb/{article_id}` | `update_kb_article` | — |
| `DELETE` | `/kb/{article_id}` | `delete_kb_article` | — |
| `POST` | `/kb/{article_id}/helpful` | `mark_kb_helpful` | — |
| `GET` | `/sla` | `list_sla_policies` | — |
| `POST` | `/sla` | `create_sla_policy` | — |
| `PUT` | `/sla/{sla_id}` | `update_sla_policy` | — |
| `GET` | `/dashboard/stats` | `dashboard_stats` | — |
| `GET` | `/tickets/{ticket_id}/followers` | `list_followers` | — |
| `POST` | `/tickets/{ticket_id}/followers` | `add_follower` | — |
| `DELETE` | `/tickets/{ticket_id}/followers/{follower_id}` | `remove_follower` | — |
| `POST` | `/tickets/{ticket_id}/follow` | `follow_ticket` | — |
| `POST` | `/tickets/{ticket_id}/unfollow` | `unfollow_ticket` | — |
| `GET` | `/sla/{sla_policy_id}/escalation-chain` | `list_escalation_chain` | — |
| `POST` | `/sla/{sla_policy_id}/escalation-chain` | `add_escalation_level` | — |
| `PUT` | `/sla/escalation-chain/{chain_id}` | `update_escalation_level` | — |
| `DELETE` | `/sla/escalation-chain/{chain_id}` | `delete_escalation_level` | — |

### `GET /categories`

**Function:** `list_categories` (line 270)

**Auth:** `current_user`


### `POST /categories`

**Function:** `create_category` (line 282)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /categories/{category_id}`

**Function:** `update_category` (line 295)

**Parameters:** `category_id`, `payload`

**Auth:** `current_user`


### `DELETE /categories/{category_id}`

**Function:** `delete_category` (line 312)

**Parameters:** `category_id`

**Auth:** `current_user`


### `GET /tickets`

**Function:** `list_tickets` (line 332)

**Parameters:** `status_filter`, `priority`, `category_id`, `assigned_to`, `search`, `page`, `limit`, `fields`

**Auth:** `current_user`


### `POST /tickets`

**Function:** `create_ticket` (line 386)

**Parameters:** `payload`, `request`

**Auth:** `current_user`


### `GET /tickets/export`

**Function:** `export_tickets` (line 452)

**Parameters:** `status_filter`

**Auth:** `current_user`


### `GET /tickets/{ticket_id}`

**Function:** `get_ticket` (line 489)

**Parameters:** `ticket_id`, `request`

**Auth:** `current_user`


### `PUT /tickets/{ticket_id}`

**Function:** `update_ticket` (line 523)

**Parameters:** `ticket_id`, `payload`, `request`

**Auth:** `current_user`


### `POST /tickets/{ticket_id}/assign`

**Function:** `assign_ticket` (line 558)

**Parameters:** `ticket_id`, `payload`, `request`

**Auth:** `current_user`


### `POST /tickets/{ticket_id}/resolve`

**Function:** `resolve_ticket` (line 601)

**Parameters:** `ticket_id`, `request`

**Auth:** `current_user`


### `POST /tickets/{ticket_id}/close`

**Function:** `close_ticket` (line 648)

**Parameters:** `ticket_id`, `request`

**Auth:** `current_user`


### `POST /tickets/{ticket_id}/reopen`

**Function:** `reopen_ticket` (line 677)

**Parameters:** `ticket_id`, `request`

**Auth:** `current_user`


### `GET /tickets/{ticket_id}/comments`

**Function:** `list_comments` (line 711)

**Parameters:** `ticket_id`

**Auth:** `current_user`


### `POST /tickets/{ticket_id}/comments`

**Function:** `add_comment` (line 740)

**Parameters:** `ticket_id`, `payload`, `request`

**Auth:** `current_user`


### `GET /kb`

**Function:** `list_kb_articles` (line 817)

**Parameters:** `search`, `category_id`, `page`, `limit`

**Auth:** `current_user`


### `GET /kb/{slug}`

**Function:** `get_kb_article` (line 860)

**Parameters:** `slug`

**Auth:** `current_user`


### `POST /kb`

**Function:** `create_kb_article` (line 884)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /kb/{article_id}`

**Function:** `update_kb_article` (line 903)

**Parameters:** `article_id`, `payload`

**Auth:** `current_user`


### `DELETE /kb/{article_id}`

**Function:** `delete_kb_article` (line 924)

**Parameters:** `article_id`

**Auth:** `current_user`


### `POST /kb/{article_id}/helpful`

**Function:** `mark_kb_helpful` (line 938)

**Parameters:** `article_id`

**Auth:** `current_user`


### `GET /sla`

**Function:** `list_sla_policies` (line 958)

**Auth:** `current_user`


### `POST /sla`

**Function:** `create_sla_policy` (line 968)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /sla/{sla_id}`

**Function:** `update_sla_policy` (line 981)

**Parameters:** `sla_id`, `payload`

**Auth:** `current_user`


### `GET /dashboard/stats`

**Function:** `dashboard_stats` (line 1000)

**Auth:** `current_user`


### `GET /tickets/{ticket_id}/followers`

**Function:** `list_followers` (line 1075)

**Parameters:** `ticket_id`

**Auth:** `current_user`


### `POST /tickets/{ticket_id}/followers`

**Function:** `add_follower` (line 1087)

**Parameters:** `ticket_id`, `payload`

**Auth:** `current_user`


### `DELETE /tickets/{ticket_id}/followers/{follower_id}`

**Function:** `remove_follower` (line 1108)

**Parameters:** `ticket_id`, `follower_id`

**Auth:** `current_user`


### `POST /tickets/{ticket_id}/follow`

**Function:** `follow_ticket` (line 1117)

**Parameters:** `ticket_id`

**Auth:** `current_user`


### `POST /tickets/{ticket_id}/unfollow`

**Function:** `unfollow_ticket` (line 1132)

**Parameters:** `ticket_id`

**Auth:** `current_user`


### `GET /sla/{sla_policy_id}/escalation-chain`

**Function:** `list_escalation_chain` (line 1168)

**Parameters:** `sla_policy_id`

**Auth:** `current_user`


### `POST /sla/{sla_policy_id}/escalation-chain`

**Function:** `add_escalation_level` (line 1179)

**Parameters:** `sla_policy_id`, `payload`

**Auth:** `current_user`


### `PUT /sla/escalation-chain/{chain_id}`

**Function:** `update_escalation_level` (line 1192)

**Parameters:** `chain_id`, `payload`

**Auth:** `current_user`


### `DELETE /sla/escalation-chain/{chain_id}`

**Function:** `delete_escalation_level` (line 1203)

**Parameters:** `chain_id`

**Auth:** `current_user`


---

## support_analytics_adv.py

Advanced Support Analytics API — Phase 3.

Endpoints for snapshot-based analytics, agent leaderboards, AI impact,
channel breakdowns, volume forecasting, and customer health scoring.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/analytics/overview` | `analytics_overview` | Return aggregated support metrics across all daily snapshots in the date range. |
| `GET` | `/analytics/trends` | `analytics_trends` | Return all daily snapshots between start_date and end_date. |
| `GET` | `/analytics/agents` | `analytics_agents` | Return agent performance leaderboard aggregated from snapshots, sorted by res... |
| `GET` | `/analytics/ai-impact` | `analytics_ai_impact` | Return AI classification, auto-response, and deflection counts with percentag... |
| `GET` | `/analytics/channels` | `analytics_channels` | Return aggregated channel breakdown across all snapshots in the date range. |
| `GET` | `/analytics/forecast` | `analytics_forecast` | Compute a simple linear-trend forecast for the next 7 days using the last 30 ... |
| `GET` | `/analytics/customer-health` | `list_customer_health` | List customer health scores with optional risk_level filter, sorted and pagin... |
| `GET` | `/analytics/customer-health/{customer_email:path}` | `get_customer_health` | Return full health detail for a specific customer email, including score fact... |
| `POST` | `/analytics/customer-health/compute` | `compute_customer_health` | Recompute CustomerHealthScore records for all customers (or a specific one). |

### `GET /analytics/overview`

**Function:** `analytics_overview` (line 206)

Return aggregated support metrics across all daily snapshots in the date range.

**Parameters:** `start_date`, `end_date`

**Response model:** `OverviewResponse`

**Auth:** `current_user`


### `GET /analytics/trends`

**Function:** `analytics_trends` (line 263)

Return all daily snapshots between start_date and end_date.

**Parameters:** `start_date`, `end_date`

**Auth:** `current_user`


### `GET /analytics/agents`

**Function:** `analytics_agents` (line 309)

Return agent performance leaderboard aggregated from snapshots, sorted by resolved count.

**Parameters:** `start_date`, `end_date`

**Auth:** `current_user`


### `GET /analytics/ai-impact`

**Function:** `analytics_ai_impact` (line 333)

Return AI classification, auto-response, and deflection counts with percentage of total tickets.

**Parameters:** `start_date`, `end_date`

**Response model:** `AIImpactResponse`

**Auth:** `current_user`


### `GET /analytics/channels`

**Function:** `analytics_channels` (line 377)

Return aggregated channel breakdown across all snapshots in the date range.

**Parameters:** `start_date`, `end_date`

**Response model:** `ChannelBreakdownResponse`

**Auth:** `current_user`


### `GET /analytics/forecast`

**Function:** `analytics_forecast` (line 407)

Compute a simple linear-trend forecast for the next 7 days using the last 30 days of snapshots.

**Auth:** `current_user`


### `GET /analytics/customer-health`

**Function:** `list_customer_health` (line 463)

List customer health scores with optional risk_level filter, sorted and paginated.

**Parameters:** `risk_level`, `sort_by`, `order`, `page`, `page_size`

**Auth:** `current_user`


### `GET /analytics/customer-health/{customer_email:path}`

**Function:** `get_customer_health` (line 514)

Return full health detail for a specific customer email, including score factors.

**Parameters:** `customer_email`

**Response model:** `CustomerHealthDetail`

**Auth:** `current_user`


### `POST /analytics/customer-health/compute`

**Function:** `compute_customer_health` (line 553)

Recompute CustomerHealthScore records for all customers (or a specific one).

Scoring methodology:
- ticket_frequency: tickets/30-day rolling window
- avg_sentiment: mean of ticket sentiment_score (-1 to 1)
- avg_csat: mean of CSAT ratings from CustomerSatisfaction (1–5 scaled to 0–100)
- effort_score: inverse of avg first-response minutes (faster = higher)
- engagement_score: based on recency of last ticket
- satisfaction_score: from avg_csat
- overall_score: weighted average of sub-scores
- risk_level: critical (<35), at_risk (35–65), healthy (>65)
- churn_probability: linear interpolation from overall_score

**Parameters:** `customer_email`

**Response model:** `ComputeHealthResponse`

**Auth:** `current_user`


---

## support_audit.py

Support Audit Log API — full ticket change history.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/tickets/{ticket_id}/audit-log` | `get_ticket_audit_log` | — |
| `GET` | `/audit-log` | `global_audit_log` | — |

### `GET /tickets/{ticket_id}/audit-log`

**Function:** `get_ticket_audit_log` (line 62)

**Parameters:** `ticket_id`, `page`, `limit`

**Auth:** `current_user`


### `GET /audit-log`

**Function:** `global_audit_log` (line 101)

**Parameters:** `ticket_id`, `user_id`, `action`, `page`, `limit`

**Auth:** `current_user`


---

## support_automation.py

Support Automation Engine (Phase 2) — CRUD, toggle, dry-run test, and evaluate endpoints.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/automations` | `list_automations` | — |
| `POST` | `/automations` | `create_automation` | — |
| `GET` | `/automations/{automation_id}` | `get_automation` | — |
| `PUT` | `/automations/{automation_id}` | `update_automation` | — |
| `DELETE` | `/automations/{automation_id}` | `delete_automation` | — |
| `POST` | `/automations/{automation_id}/toggle` | `toggle_automation` | — |
| `POST` | `/automations/{automation_id}/test` | `test_automation` | — |
| `GET` | `/automations/{automation_id}/logs` | `list_automation_logs` | — |
| `POST` | `/automations/evaluate` | `evaluate_automations` | Iterate over all active automations, test each one's conditions against |

### `GET /automations`

**Function:** `list_automations` (line 189)

**Parameters:** `is_active`, `trigger_event`, `page`, `page_size`

**Auth:** `current_user`


### `POST /automations`

**Function:** `create_automation` (line 230)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /automations/{automation_id}`

**Function:** `get_automation` (line 251)

**Parameters:** `automation_id`

**Auth:** `current_user`


### `PUT /automations/{automation_id}`

**Function:** `update_automation` (line 275)

**Parameters:** `automation_id`, `payload`

**Auth:** `current_user`


### `DELETE /automations/{automation_id}`

**Function:** `delete_automation` (line 298)

**Parameters:** `automation_id`

**Auth:** `current_user`


### `POST /automations/{automation_id}/toggle`

**Function:** `toggle_automation` (line 313)

**Parameters:** `automation_id`

**Auth:** `current_user`


### `POST /automations/{automation_id}/test`

**Function:** `test_automation` (line 341)

**Parameters:** `automation_id`, `payload`

**Auth:** `current_user`


### `GET /automations/{automation_id}/logs`

**Function:** `list_automation_logs` (line 377)

**Parameters:** `automation_id`, `page`, `page_size`

**Auth:** `current_user`


### `POST /automations/evaluate`

**Function:** `evaluate_automations` (line 424)

Iterate over all active automations, test each one's conditions against
the given ticket, and execute actions for every automation that matches.
Logs each execution. Returns the list of automation names that were
executed.

**Parameters:** `payload`

**Auth:** `current_user`


---

## support_ext.py

Support Extensions — SLA status, Canned Responses, Ticket Merge, CSAT, Reports, Dashboard KPIs.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/sla-policies` | `list_sla_policies` | — |
| `POST` | `/sla-policies` | `create_sla_policy` | — |
| `GET` | `/tickets/{ticket_id}/sla-status` | `get_ticket_sla_status` | — |
| `GET` | `/canned-responses` | `list_canned_responses` | — |
| `POST` | `/canned-responses` | `create_canned_response` | — |
| `PUT` | `/canned-responses/{cr_id}` | `update_canned_response` | — |
| `DELETE` | `/canned-responses/{cr_id}` | `delete_canned_response` | — |
| `POST` | `/tickets/{ticket_id}/merge` | `merge_tickets` | Merge source tickets into the target ticket. |
| `POST` | `/tickets/{ticket_id}/satisfaction` | `submit_satisfaction` | — |
| `GET` | `/satisfaction-report` | `satisfaction_report` | — |
| `GET` | `/reports/response-times` | `report_response_times` | Average first-response time grouped by priority. |
| `GET` | `/reports/satisfaction` | `report_satisfaction` | CSAT trends over the last N days. |
| `GET` | `/dashboard/kpis` | `dashboard_kpis` | — |
| `GET` | `/routing-rules` | `list_routing_rules` | — |
| `POST` | `/routing-rules` | `create_routing_rule` | — |
| `GET` | `/routing-rules/{rule_id}` | `get_routing_rule` | — |
| `PUT` | `/routing-rules/{rule_id}` | `update_routing_rule` | — |
| `DELETE` | `/routing-rules/{rule_id}` | `delete_routing_rule` | — |

### `GET /sla-policies`

**Function:** `list_sla_policies` (line 103)

**Auth:** `current_user`


### `POST /sla-policies`

**Function:** `create_sla_policy` (line 119)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /tickets/{ticket_id}/sla-status`

**Function:** `get_ticket_sla_status` (line 138)

**Parameters:** `ticket_id`

**Auth:** `current_user`


### `GET /canned-responses`

**Function:** `list_canned_responses` (line 204)

**Parameters:** `category`, `search`

**Auth:** `current_user`


### `POST /canned-responses`

**Function:** `create_canned_response` (line 231)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /canned-responses/{cr_id}`

**Function:** `update_canned_response` (line 249)

**Parameters:** `cr_id`, `payload`

**Auth:** `current_user`


### `DELETE /canned-responses/{cr_id}`

**Function:** `delete_canned_response` (line 272)

**Parameters:** `cr_id`

**Auth:** `current_user`


### `POST /tickets/{ticket_id}/merge`

**Function:** `merge_tickets` (line 291)

Merge source tickets into the target ticket.
- All comments from source tickets are moved to the target.
- Source tickets are closed with a note referencing the target.

**Parameters:** `ticket_id`, `payload`

**Auth:** `current_user`


### `POST /tickets/{ticket_id}/satisfaction`

**Function:** `submit_satisfaction` (line 360)

**Parameters:** `ticket_id`, `payload`

**Auth:** `current_user`


### `GET /satisfaction-report`

**Function:** `satisfaction_report` (line 398)

**Auth:** `current_user`


### `GET /reports/response-times`

**Function:** `report_response_times` (line 454)

Average first-response time grouped by priority.

**Auth:** `current_user`


### `GET /reports/satisfaction`

**Function:** `report_satisfaction` (line 496)

CSAT trends over the last N days.

**Parameters:** `days`

**Auth:** `current_user`


### `GET /dashboard/kpis`

**Function:** `dashboard_kpis` (line 549)

**Auth:** `current_user`


### `GET /routing-rules`

**Function:** `list_routing_rules` (line 783)

**Auth:** `current_user`


### `POST /routing-rules`

**Function:** `create_routing_rule` (line 803)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /routing-rules/{rule_id}`

**Function:** `get_routing_rule` (line 825)

**Parameters:** `rule_id`

**Auth:** `current_user`


### `PUT /routing-rules/{rule_id}`

**Function:** `update_routing_rule` (line 837)

**Parameters:** `rule_id`, `payload`

**Auth:** `current_user`


### `DELETE /routing-rules/{rule_id}`

**Function:** `delete_routing_rule` (line 860)

**Parameters:** `rule_id`

**Auth:** `current_user`


---

## support_forum.py

Support Phase 2 — Community Forum API.

Endpoints for ForumCategory, ForumPost, ForumReply, and post→ticket conversion.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/forum/categories` | `list_forum_categories` | — |
| `POST` | `/forum/categories` | `create_forum_category` | — |
| `PUT` | `/forum/categories/{category_id}` | `update_forum_category` | — |
| `DELETE` | `/forum/categories/{category_id}` | `delete_forum_category` | — |
| `GET` | `/forum/posts` | `list_forum_posts` | — |
| `POST` | `/forum/posts` | `create_forum_post` | — |
| `GET` | `/forum/posts/{post_id}` | `get_forum_post` | — |
| `PUT` | `/forum/posts/{post_id}` | `update_forum_post` | — |
| `DELETE` | `/forum/posts/{post_id}` | `delete_forum_post` | — |
| `POST` | `/forum/posts/{post_id}/upvote` | `upvote_forum_post` | — |
| `POST` | `/forum/posts/{post_id}/replies` | `create_forum_reply` | — |
| `POST` | `/forum/replies/{reply_id}/upvote` | `upvote_forum_reply` | — |
| `POST` | `/forum/replies/{reply_id}/best-answer` | `mark_best_answer` | — |
| `POST` | `/forum/posts/{post_id}/convert-to-ticket` | `convert_post_to_ticket` | — |

### `GET /forum/categories`

**Function:** `list_forum_categories` (line 148)

**Parameters:** `active_only`

**Auth:** `current_user`


### `POST /forum/categories`

**Function:** `create_forum_category` (line 172)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /forum/categories/{category_id}`

**Function:** `update_forum_category` (line 202)

**Parameters:** `category_id`, `payload`

**Auth:** `current_user`


### `DELETE /forum/categories/{category_id}`

**Function:** `delete_forum_category` (line 237)

**Parameters:** `category_id`

**Auth:** `current_user`


### `GET /forum/posts`

**Function:** `list_forum_posts` (line 255)

**Parameters:** `category_id`, `pinned_first`, `page`, `page_size`

**Auth:** `current_user`


### `POST /forum/posts`

**Function:** `create_forum_post` (line 299)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /forum/posts/{post_id}`

**Function:** `get_forum_post` (line 328)

**Parameters:** `post_id`

**Auth:** `current_user`


### `PUT /forum/posts/{post_id}`

**Function:** `update_forum_post` (line 347)

**Parameters:** `post_id`, `payload`

**Auth:** `current_user`


### `DELETE /forum/posts/{post_id}`

**Function:** `delete_forum_post` (line 370)

**Parameters:** `post_id`

**Auth:** `current_user`


### `POST /forum/posts/{post_id}/upvote`

**Function:** `upvote_forum_post` (line 384)

**Parameters:** `post_id`

**Auth:** `current_user`


### `POST /forum/posts/{post_id}/replies`

**Function:** `create_forum_reply` (line 408)

**Parameters:** `post_id`, `payload`

**Auth:** `current_user`


### `POST /forum/replies/{reply_id}/upvote`

**Function:** `upvote_forum_reply` (line 438)

**Parameters:** `reply_id`

**Auth:** `current_user`


### `POST /forum/replies/{reply_id}/best-answer`

**Function:** `mark_best_answer` (line 454)

**Parameters:** `reply_id`

**Auth:** `current_user`


### `POST /forum/posts/{post_id}/convert-to-ticket`

**Function:** `convert_post_to_ticket` (line 500)

**Parameters:** `post_id`

**Auth:** `current_user`


---

## support_inbound.py

Support Inbound Email API — configure email-to-ticket routing rules.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/inbound-email/rules` | `list_inbound_rules` | — |
| `POST` | `/inbound-email/rules` | `create_inbound_rule` | — |
| `PUT` | `/inbound-email/rules/{rule_id}` | `update_inbound_rule` | — |
| `DELETE` | `/inbound-email/rules/{rule_id}` | `delete_inbound_rule` | — |

### `GET /inbound-email/rules`

**Function:** `list_inbound_rules` (line 62)

**Auth:** `current_user`


### `POST /inbound-email/rules`

**Function:** `create_inbound_rule` (line 74)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /inbound-email/rules/{rule_id}`

**Function:** `update_inbound_rule` (line 87)

**Parameters:** `rule_id`, `payload`

**Auth:** `current_user`


### `DELETE /inbound-email/rules/{rule_id}`

**Function:** `delete_inbound_rule` (line 106)

**Parameters:** `rule_id`

**Auth:** `current_user`


---

## support_livechat.py

Support Live Chat API — sessions, messages, and WebSocket real-time messaging.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/live-chat/sessions` | `list_sessions` | — |
| `POST` | `/live-chat/sessions` | `create_session` | — |
| `GET` | `/live-chat/sessions/{session_id}` | `get_session` | — |
| `POST` | `/live-chat/sessions/{session_id}/messages` | `send_message` | — |
| `POST` | `/live-chat/sessions/{session_id}/assign` | `assign_agent` | — |
| `POST` | `/live-chat/sessions/{session_id}/transfer` | `transfer_session` | — |
| `POST` | `/live-chat/sessions/{session_id}/close` | `close_session` | — |
| `POST` | `/live-chat/sessions/{session_id}/convert-to-ticket` | `convert_to_ticket` | Convert a chat session into a support ticket with the chat transcript as desc... |

### `GET /live-chat/sessions`

**Function:** `list_sessions` (line 121)

**Parameters:** `status_filter`, `page`, `limit`

**Auth:** `current_user`


### `POST /live-chat/sessions`

**Function:** `create_session` (line 156)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /live-chat/sessions/{session_id}`

**Function:** `get_session` (line 191)

**Parameters:** `session_id`

**Auth:** `current_user`


### `POST /live-chat/sessions/{session_id}/messages`

**Function:** `send_message` (line 211)

**Parameters:** `session_id`, `payload`

**Auth:** `current_user`


### `POST /live-chat/sessions/{session_id}/assign`

**Function:** `assign_agent` (line 251)

**Parameters:** `session_id`, `payload`

**Auth:** `current_user`


### `POST /live-chat/sessions/{session_id}/transfer`

**Function:** `transfer_session` (line 292)

**Parameters:** `session_id`, `payload`

**Auth:** `current_user`


### `POST /live-chat/sessions/{session_id}/close`

**Function:** `close_session` (line 334)

**Parameters:** `session_id`

**Auth:** `current_user`


### `POST /live-chat/sessions/{session_id}/convert-to-ticket`

**Function:** `convert_to_ticket` (line 375)

Convert a chat session into a support ticket with the chat transcript as description.

**Parameters:** `session_id`

**Auth:** `current_user`


---

## support_omnichannel.py

Support Omnichannel API — channel configuration, inbound webhooks, and per-channel stats.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/omnichannel/channels` | `list_channels` | — |
| `POST` | `/omnichannel/channels` | `create_channel` | — |
| `GET` | `/omnichannel/channels/{channel_id}` | `get_channel` | — |
| `PUT` | `/omnichannel/channels/{channel_id}` | `update_channel` | — |
| `DELETE` | `/omnichannel/channels/{channel_id}` | `delete_channel` | — |
| `POST` | `/omnichannel/channels/{channel_id}/toggle` | `toggle_channel` | — |
| `POST` | `/omnichannel/channels/{channel_id}/test` | `test_channel` | — |
| `POST` | `/omnichannel/webhook/{channel_name}` | `inbound_webhook` | Public webhook endpoint called by external messaging platforms (WhatsApp, Fac... |
| `GET` | `/omnichannel/stats` | `omnichannel_stats` | Return a breakdown of ticket counts grouped by the channel field on Ticket. |

### `GET /omnichannel/channels`

**Function:** `list_channels` (line 114)

**Auth:** `current_user`


### `POST /omnichannel/channels`

**Function:** `create_channel` (line 126)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /omnichannel/channels/{channel_id}`

**Function:** `get_channel` (line 159)

**Parameters:** `channel_id`

**Auth:** `current_user`


### `PUT /omnichannel/channels/{channel_id}`

**Function:** `update_channel` (line 169)

**Parameters:** `channel_id`, `payload`

**Auth:** `current_user`


### `DELETE /omnichannel/channels/{channel_id}`

**Function:** `delete_channel` (line 198)

**Parameters:** `channel_id`

**Auth:** `current_user`


### `POST /omnichannel/channels/{channel_id}/toggle`

**Function:** `toggle_channel` (line 212)

**Parameters:** `channel_id`

**Auth:** `current_user`


### `POST /omnichannel/channels/{channel_id}/test`

**Function:** `test_channel` (line 228)

**Parameters:** `channel_id`

**Auth:** `current_user`


### `POST /omnichannel/webhook/{channel_name}`

**Function:** `inbound_webhook` (line 243)

Public webhook endpoint called by external messaging platforms (WhatsApp, Facebook, etc.).
Validates the channel exists and is active, then creates a support ticket from the message.
No auth token is required — the caller is an external platform.

**Parameters:** `channel_name`, `payload`


### `GET /omnichannel/stats`

**Function:** `omnichannel_stats` (line 300)

Return a breakdown of ticket counts grouped by the channel field on Ticket.

**Auth:** `current_user`


---

## support_portal.py

Support Phase 2 — Customer Self-Service Portal API.

Admin endpoints: manage portal accounts (requires internal staff JWT).
Customer-facing endpoints: login, tickets, KB articles (requires X-Portal-Token).


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/portal/accounts` | `list_portal_accounts` | List all customer portal accounts. Supports search by email or display_name. |
| `POST` | `/portal/accounts` | `create_portal_account` | Create a new customer portal account. Hashes the supplied password with bcrypt. |
| `PUT` | `/portal/accounts/{account_id}` | `update_portal_account` | Update display_name, is_active, or contact_id for a portal account. |
| `DELETE` | `/portal/accounts/{account_id}` | `deactivate_portal_account` | Deactivate a portal account (soft delete — sets is_active=False). |
| `POST` | `/portal/login` | `portal_login` | Authenticate a portal customer and return a signed JWT (X-Portal-Token). |
| `GET` | `/portal/my-tickets` | `list_my_tickets` | List all tickets associated with the authenticated portal customer's email. |
| `POST` | `/portal/my-tickets` | `create_my_ticket` | Create a new support ticket from the portal. Channel is set to 'portal'. |
| `GET` | `/portal/my-tickets/{ticket_id}` | `get_my_ticket` | Get full ticket detail including non-internal comments. |
| `POST` | `/portal/my-tickets/{ticket_id}/comments` | `add_my_ticket_comment` | Add a customer reply to a ticket. Publishes support.comment.added event. |
| `GET` | `/portal/kb` | `search_kb_articles` | Search published knowledge-base articles. No authentication required. |
| `GET` | `/portal/kb/{article_id}` | `get_kb_article` | Retrieve a single published KB article and increment its view count. |

### `GET /portal/accounts`

**Function:** `list_portal_accounts` (line 148)

List all customer portal accounts. Supports search by email or display_name.

**Parameters:** `search`, `skip`, `limit`

**Auth:** `current_user`


### `POST /portal/accounts`

**Function:** `create_portal_account` (line 183)

Create a new customer portal account. Hashes the supplied password with bcrypt.

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /portal/accounts/{account_id}`

**Function:** `update_portal_account` (line 210)

Update display_name, is_active, or contact_id for a portal account.

**Parameters:** `account_id`, `payload`

**Auth:** `current_user`


### `DELETE /portal/accounts/{account_id}`

**Function:** `deactivate_portal_account` (line 234)

Deactivate a portal account (soft delete — sets is_active=False).

**Parameters:** `account_id`

**Auth:** `current_user`


### `POST /portal/login`

**Function:** `portal_login` (line 252)

Authenticate a portal customer and return a signed JWT (X-Portal-Token).

**Parameters:** `payload`


### `GET /portal/my-tickets`

**Function:** `list_my_tickets` (line 277)

List all tickets associated with the authenticated portal customer's email.

**Parameters:** `request`, `skip`, `limit`, `account`


### `POST /portal/my-tickets`

**Function:** `create_my_ticket` (line 308)

Create a new support ticket from the portal. Channel is set to 'portal'.

**Parameters:** `payload`, `request`, `account`


### `GET /portal/my-tickets/{ticket_id}`

**Function:** `get_my_ticket` (line 355)

Get full ticket detail including non-internal comments.

**Parameters:** `ticket_id`, `request`, `account`


### `POST /portal/my-tickets/{ticket_id}/comments`

**Function:** `add_my_ticket_comment` (line 380)

Add a customer reply to a ticket. Publishes support.comment.added event.

**Parameters:** `ticket_id`, `payload`, `request`, `account`


### `GET /portal/kb`

**Function:** `search_kb_articles` (line 438)

Search published knowledge-base articles. No authentication required.

**Parameters:** `q`, `skip`, `limit`


### `GET /portal/kb/{article_id}`

**Function:** `get_kb_article` (line 488)

Retrieve a single published KB article and increment its view count.

**Parameters:** `article_id`


---

## support_presence.py

Support Agent Presence API — Redis-backed online status, typing indicators, collision detection.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/presence/heartbeat` | `heartbeat` | — |
| `GET` | `/presence/agents` | `list_online_agents` | — |
| `GET` | `/presence/ticket/{ticket_id}` | `ticket_viewers` | — |
| `POST` | `/presence/typing/{ticket_id}` | `set_typing` | — |
| `GET` | `/presence/typing/{ticket_id}` | `get_typing` | — |

### `POST /presence/heartbeat`

**Function:** `heartbeat` (line 52)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /presence/agents`

**Function:** `list_online_agents` (line 84)

**Auth:** `current_user`


### `GET /presence/ticket/{ticket_id}`

**Function:** `ticket_viewers` (line 109)

**Parameters:** `ticket_id`

**Auth:** `current_user`


### `POST /presence/typing/{ticket_id}`

**Function:** `set_typing` (line 133)

**Parameters:** `ticket_id`

**Auth:** `current_user`


### `GET /presence/typing/{ticket_id}`

**Function:** `get_typing` (line 152)

**Parameters:** `ticket_id`

**Auth:** `current_user`


---

## support_proactive.py

Support Proactive Rules API — Phase 3.

Manages rules that trigger outreach (create_ticket / send_email / notify_agent)
before customers report issues.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/proactive/rules` | `list_rules` | — |
| `POST` | `/proactive/rules` | `create_rule` | — |
| `GET` | `/proactive/rules/{rule_id}` | `get_rule` | — |
| `PUT` | `/proactive/rules/{rule_id}` | `update_rule` | — |
| `DELETE` | `/proactive/rules/{rule_id}` | `delete_rule` | — |
| `POST` | `/proactive/rules/{rule_id}/toggle` | `toggle_rule` | — |
| `POST` | `/proactive/rules/{rule_id}/test` | `test_rule` | — |
| `POST` | `/proactive/rules/evaluate` | `evaluate_rules` | Evaluate all active rules against an event. Execute actions for matching rules. |

### `GET /proactive/rules`

**Function:** `list_rules` (line 148)

**Parameters:** `trigger_type`, `is_active`

**Auth:** `current_user`


### `POST /proactive/rules`

**Function:** `create_rule` (line 170)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /proactive/rules/{rule_id}`

**Function:** `get_rule` (line 190)

**Parameters:** `rule_id`

**Auth:** `current_user`


### `PUT /proactive/rules/{rule_id}`

**Function:** `update_rule` (line 202)

**Parameters:** `rule_id`, `payload`

**Auth:** `current_user`


### `DELETE /proactive/rules/{rule_id}`

**Function:** `delete_rule` (line 225)

**Parameters:** `rule_id`

**Auth:** `current_user`


### `POST /proactive/rules/{rule_id}/toggle`

**Function:** `toggle_rule` (line 238)

**Parameters:** `rule_id`

**Auth:** `current_user`


### `POST /proactive/rules/{rule_id}/test`

**Function:** `test_rule` (line 254)

**Parameters:** `rule_id`, `payload`

**Auth:** `current_user`


### `POST /proactive/rules/evaluate`

**Function:** `evaluate_rules` (line 280)

Evaluate all active rules against an event. Execute actions for matching rules.

**Parameters:** `payload`

**Auth:** `current_user`


---

## support_sandbox.py

Support Sandboxes (Phase 3) — create, test, and promote automation configs.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/sandboxes` | `list_sandboxes` | List support sandboxes, optionally filtered by is_active. |
| `POST` | `/sandboxes` | `create_sandbox` | Create a new sandbox and auto-snapshot current automations and SLA policies. |
| `GET` | `/sandboxes/{sandbox_id}` | `get_sandbox` | Get sandbox detail including config_snapshot and test_results. |
| `PUT` | `/sandboxes/{sandbox_id}` | `update_sandbox` | Update sandbox name, description, or expires_at. |
| `DELETE` | `/sandboxes/{sandbox_id}` | `delete_sandbox` | Delete a sandbox. |
| `POST` | `/sandboxes/{sandbox_id}/run-test` | `run_test` | Run a test ticket through the sandbox's snapshotted automations and record re... |
| `POST` | `/sandboxes/{sandbox_id}/refresh-config` | `refresh_config` | Re-snapshot current automations and SLA policies into this sandbox. |
| `POST` | `/sandboxes/{sandbox_id}/promote` | `promote_sandbox` | Promote sandbox config to production (placeholder). |

### `GET /sandboxes`

**Function:** `list_sandboxes` (line 153)

List support sandboxes, optionally filtered by is_active.

**Parameters:** `is_active`

**Auth:** `current_user`


### `POST /sandboxes`

**Function:** `create_sandbox` (line 166)

Create a new sandbox and auto-snapshot current automations and SLA policies.

**Parameters:** `payload`

**Response model:** `SandboxOut`

**Auth:** `current_user`


### `GET /sandboxes/{sandbox_id}`

**Function:** `get_sandbox` (line 189)

Get sandbox detail including config_snapshot and test_results.

**Parameters:** `sandbox_id`

**Response model:** `SandboxOut`

**Auth:** `current_user`


### `PUT /sandboxes/{sandbox_id}`

**Function:** `update_sandbox` (line 202)

Update sandbox name, description, or expires_at.

**Parameters:** `sandbox_id`, `payload`

**Response model:** `SandboxOut`

**Auth:** `current_user`


### `DELETE /sandboxes/{sandbox_id}`

**Function:** `delete_sandbox` (line 226)

Delete a sandbox.

**Parameters:** `sandbox_id`

**Auth:** `current_user`


### `POST /sandboxes/{sandbox_id}/run-test`

**Function:** `run_test` (line 241)

Run a test ticket through the sandbox's snapshotted automations and record results.

**Parameters:** `sandbox_id`, `ticket`

**Auth:** `current_user`


### `POST /sandboxes/{sandbox_id}/refresh-config`

**Function:** `refresh_config` (line 285)

Re-snapshot current automations and SLA policies into this sandbox.

**Parameters:** `sandbox_id`

**Response model:** `SandboxOut`

**Auth:** `current_user`


### `POST /sandboxes/{sandbox_id}/promote`

**Function:** `promote_sandbox` (line 302)

Promote sandbox config to production (placeholder).

**Parameters:** `sandbox_id`

**Auth:** `current_user`


---

## support_skills.py

Support Agent Skills & Workforce Management API — Phase 3.

Provides skill-based routing, shift scheduling, on-duty checks, and
weekly coverage heatmaps for support agents.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/skills` | `list_skills` | Return unique skill names with the number of agents holding each skill. |
| `GET` | `/skills/agents/{agent_id}` | `list_agent_skills` | Return all skills registered for a specific agent. |
| `POST` | `/skills` | `add_skill` | Add a skill entry for an agent. |
| `PUT` | `/skills/{skill_id}` | `update_skill` | Update a skill's proficiency or settings. |
| `DELETE` | `/skills/{skill_id}` | `delete_skill` | Delete a skill entry. |
| `POST` | `/skills/route-ticket` | `route_ticket` | Skill-based ticket routing. |
| `GET` | `/shifts/agents/{agent_id}` | `list_agent_shifts` | Return all shifts for a specific agent. |
| `POST` | `/shifts` | `create_shift` | Create a shift entry for an agent. |
| `PUT` | `/shifts/{shift_id}` | `update_shift` | Update a shift's schedule or active state. |
| `DELETE` | `/shifts/{shift_id}` | `delete_shift` | Delete a shift entry. |
| `GET` | `/shifts/on-duty` | `list_on_duty_agents` | Return agents currently on duty based on UTC time and active shifts. |
| `GET` | `/shifts/coverage` | `get_coverage_heatmap` | Return a 7×24 coverage heatmap showing agent count per (day, hour) slot. |

### `GET /skills`

**Function:** `list_skills` (line 173)

Return unique skill names with the number of agents holding each skill.

**Auth:** `_current_user`


### `GET /skills/agents/{agent_id}`

**Function:** `list_agent_skills` (line 188)

Return all skills registered for a specific agent.

**Parameters:** `agent_id`

**Auth:** `_current_user`


### `POST /skills`

**Function:** `add_skill` (line 204)

Add a skill entry for an agent.

**Parameters:** `payload`

**Response model:** `SkillOut`

**Auth:** `_current_user`


### `PUT /skills/{skill_id}`

**Function:** `update_skill` (line 230)

Update a skill's proficiency or settings.

**Parameters:** `skill_id`, `payload`

**Response model:** `SkillOut`

**Auth:** `_current_user`


### `DELETE /skills/{skill_id}`

**Function:** `delete_skill` (line 264)

Delete a skill entry.

**Parameters:** `skill_id`

**Auth:** `_current_user`


### `POST /skills/route-ticket`

**Function:** `route_ticket` (line 279)

Skill-based ticket routing.

Derives required skills from the ticket's category name and tags, then
finds the best available agent ordered by matching-skill proficiency.
Returns the suggested agent, matching skill names, and a combined score.

**Parameters:** `payload`

**Response model:** `RouteTicketResponse`

**Auth:** `_current_user`


### `GET /shifts/agents/{agent_id}`

**Function:** `list_agent_shifts` (line 358)

Return all shifts for a specific agent.

**Parameters:** `agent_id`

**Auth:** `_current_user`


### `POST /shifts`

**Function:** `create_shift` (line 374)

Create a shift entry for an agent.

**Parameters:** `payload`

**Response model:** `ShiftOut`

**Auth:** `_current_user`


### `PUT /shifts/{shift_id}`

**Function:** `update_shift` (line 400)

Update a shift's schedule or active state.

**Parameters:** `shift_id`, `payload`

**Response model:** `ShiftOut`

**Auth:** `_current_user`


### `DELETE /shifts/{shift_id}`

**Function:** `delete_shift` (line 434)

Delete a shift entry.

**Parameters:** `shift_id`

**Auth:** `_current_user`


### `GET /shifts/on-duty`

**Function:** `list_on_duty_agents` (line 449)

Return agents currently on duty based on UTC time and active shifts.

Compares the current UTC weekday (0=Monday) and HH:MM time against each
agent's active shift windows.  Overnight shifts (end_time < start_time)
are handled correctly.

**Auth:** `_current_user`


### `GET /shifts/coverage`

**Function:** `get_coverage_heatmap` (line 517)

Return a 7×24 coverage heatmap showing agent count per (day, hour) slot.

Each cell grid[day][hour] contains the number of agents whose active shift
covers that hour on that day of the week.  Overnight shifts are handled.

**Response model:** `CoverageHeatmap`

**Auth:** `_current_user`


---

## support_templates.py

Support Ticket Templates API — pre-defined ticket creation templates.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/templates` | `list_templates` | — |
| `POST` | `/templates` | `create_template` | — |
| `PUT` | `/templates/{template_id}` | `update_template` | — |
| `DELETE` | `/templates/{template_id}` | `delete_template` | — |
| `POST` | `/templates/{template_id}/apply` | `apply_template` | Create a new ticket pre-filled from template defaults. |

### `GET /templates`

**Function:** `list_templates` (line 64)

**Parameters:** `active_only`

**Auth:** `current_user`


### `POST /templates`

**Function:** `create_template` (line 85)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /templates/{template_id}`

**Function:** `update_template` (line 105)

**Parameters:** `template_id`, `payload`

**Auth:** `current_user`


### `DELETE /templates/{template_id}`

**Function:** `delete_template` (line 128)

**Parameters:** `template_id`

**Auth:** `current_user`


### `POST /templates/{template_id}/apply`

**Function:** `apply_template` (line 143)

Create a new ticket pre-filled from template defaults.

**Parameters:** `template_id`, `subject_override`, `description_override`

**Auth:** `current_user`


---

## support_time.py

Support Time Tracking API — start/stop timer, time entries per ticket.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/tickets/{ticket_id}/time/start` | `start_timer` | — |
| `POST` | `/tickets/{ticket_id}/time/stop` | `stop_timer` | — |
| `GET` | `/tickets/{ticket_id}/time` | `list_time_entries` | — |
| `PUT` | `/time-entries/{entry_id}` | `update_time_entry` | — |
| `DELETE` | `/time-entries/{entry_id}` | `delete_time_entry` | — |
| `GET` | `/time/report` | `time_report` | — |

### `POST /tickets/{ticket_id}/time/start`

**Function:** `start_timer` (line 55)

**Parameters:** `ticket_id`

**Auth:** `current_user`


### `POST /tickets/{ticket_id}/time/stop`

**Function:** `stop_timer` (line 93)

**Parameters:** `ticket_id`

**Auth:** `current_user`


### `GET /tickets/{ticket_id}/time`

**Function:** `list_time_entries` (line 125)

**Parameters:** `ticket_id`

**Auth:** `current_user`


### `PUT /time-entries/{entry_id}`

**Function:** `update_time_entry` (line 151)

**Parameters:** `entry_id`, `payload`

**Auth:** `current_user`


### `DELETE /time-entries/{entry_id}`

**Function:** `delete_time_entry` (line 176)

**Parameters:** `entry_id`

**Auth:** `current_user`


### `GET /time/report`

**Function:** `time_report` (line 192)

**Parameters:** `days`

**Auth:** `current_user`


---

## support_views.py

Support Saved Views API — user-scoped saved ticket filters.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/views` | `list_views` | — |
| `POST` | `/views` | `create_view` | — |
| `PUT` | `/views/{view_id}` | `update_view` | — |
| `DELETE` | `/views/{view_id}` | `delete_view` | — |
| `GET` | `/views/{view_id}/tickets` | `execute_view` | — |

### `GET /views`

**Function:** `list_views` (line 58)

**Auth:** `current_user`


### `POST /views`

**Function:** `create_view` (line 77)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /views/{view_id}`

**Function:** `update_view` (line 106)

**Parameters:** `view_id`, `payload`

**Auth:** `current_user`


### `DELETE /views/{view_id}`

**Function:** `delete_view` (line 127)

**Parameters:** `view_id`

**Auth:** `current_user`


### `GET /views/{view_id}/tickets`

**Function:** `execute_view` (line 144)

**Parameters:** `view_id`, `page`, `limit`

**Auth:** `current_user`


---

## support_voice.py

Support Voice Call Management API — Phase 3.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/voice/calls` | `list_calls` | List voice call records with optional filters and pagination. |
| `POST` | `/voice/calls` | `create_call` | Create a new voice call record. Sets agent to current user, status to ringing. |
| `GET` | `/voice/calls/{call_id}` | `get_call` | Get a single voice call record with ticket and agent details. |
| `PUT` | `/voice/calls/{call_id}` | `update_call` | Update call fields. Auto-calculates duration_seconds and wait_seconds when en... |
| `POST` | `/voice/calls/{call_id}/end` | `end_call` | End a call: set ended_at to now, status to completed, calculate duration. |
| `POST` | `/voice/calls/{call_id}/link-ticket` | `link_ticket` | Link a voice call to an existing support ticket. |
| `POST` | `/voice/calls/{call_id}/transcribe` | `transcribe_call` | Queue transcription for a call (actual work done by Celery task). |
| `GET` | `/voice/stats` | `get_call_stats` | Aggregate call statistics: totals, averages, breakdowns by direction and status. |
| `GET` | `/voice/agents/{agent_id}/calls` | `get_agent_calls` | List all voice calls handled by a specific agent. |

### `GET /voice/calls`

**Function:** `list_calls` (line 91)

List voice call records with optional filters and pagination.

**Parameters:** `direction`, `status_filter`, `agent_id`, `start_date`, `end_date`, `skip`, `limit`

**Auth:** `_`


### `POST /voice/calls`

**Function:** `create_call` (line 132)

Create a new voice call record. Sets agent to current user, status to ringing.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /voice/calls/{call_id}`

**Function:** `get_call` (line 154)

Get a single voice call record with ticket and agent details.

**Parameters:** `call_id`

**Auth:** `_`


### `PUT /voice/calls/{call_id}`

**Function:** `update_call` (line 165)

Update call fields. Auto-calculates duration_seconds and wait_seconds when ended_at is set.

**Parameters:** `call_id`, `payload`

**Auth:** `_`


### `POST /voice/calls/{call_id}/end`

**Function:** `end_call` (line 214)

End a call: set ended_at to now, status to completed, calculate duration.

**Parameters:** `call_id`

**Auth:** `_`


### `POST /voice/calls/{call_id}/link-ticket`

**Function:** `link_ticket` (line 249)

Link a voice call to an existing support ticket.

**Parameters:** `call_id`, `payload`

**Auth:** `_`


### `POST /voice/calls/{call_id}/transcribe`

**Function:** `transcribe_call` (line 264)

Queue transcription for a call (actual work done by Celery task).

**Parameters:** `call_id`

**Auth:** `_`


### `GET /voice/stats`

**Function:** `get_call_stats` (line 277)

Aggregate call statistics: totals, averages, breakdowns by direction and status.

**Parameters:** `start_date`, `end_date`

**Auth:** `_`


### `GET /voice/agents/{agent_id}/calls`

**Function:** `get_agent_calls` (line 321)

List all voice calls handled by a specific agent.

**Parameters:** `agent_id`, `skip`, `limit`

**Auth:** `_`

