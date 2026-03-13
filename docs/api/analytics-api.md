# Analytics — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 66


## Contents

- [analytics.py](#analytics) (6 endpoints)
- [analytics_ext.py](#analytics-ext) (35 endpoints)
- [analytics_schema.py](#analytics-schema) (25 endpoints)

---

## analytics.py

Analytics API — aggregated stats endpoints (replaces Superset).

All analytics are now served directly from our PostgreSQL database.
Materialized views (mv_monthly_revenue, mv_monthly_users, mv_support_metrics,
mv_module_counts) are used for fast reads; live queries serve as fallback
before the views are populated, and for data not covered by views.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/stats/revenue` | `revenue_stats` | Return monthly revenue totals — materialized view first, live query fallback. |
| `GET` | `/stats/users` | `user_growth_stats` | Return monthly new-user counts — materialized view first, live query fallback. |
| `GET` | `/stats/modules` | `module_usage_stats` | Return record counts per ERP module — materialized view first, live fallback. |
| `GET` | `/stats/expenses` | `expense_stats` | Return monthly expense totals from journal entries. |
| `GET` | `/stats/top-products` | `top_products_stats` | Return top products by sales volume. |
| `GET` | `/stats/support-metrics` | `support_metrics` | Return support ticket stats — materialized view first, live fallback. |

### `GET /stats/revenue`

**Function:** `revenue_stats` (line 25)

Return monthly revenue totals — materialized view first, live query fallback.

**Parameters:** `months`

**Auth:** `current_user`


### `GET /stats/users`

**Function:** `user_growth_stats` (line 82)

Return monthly new-user counts — materialized view first, live query fallback.

**Parameters:** `months`

**Auth:** `current_user`


### `GET /stats/modules`

**Function:** `module_usage_stats` (line 137)

Return record counts per ERP module — materialized view first, live fallback.

**Auth:** `current_user`


### `GET /stats/expenses`

**Function:** `expense_stats` (line 182)

Return monthly expense totals from journal entries.

**Parameters:** `months`

**Auth:** `current_user`


### `GET /stats/top-products`

**Function:** `top_products_stats` (line 214)

Return top products by sales volume.

**Parameters:** `limit`

**Auth:** `current_user`


### `GET /stats/support-metrics`

**Function:** `support_metrics` (line 249)

Return support ticket stats — materialized view first, live fallback.

**Auth:** `current_user`


---

## analytics_ext.py

Analytics Extension API — dashboards, widgets, queries, reports, alerts, KPIs.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/dashboards` | `list_dashboards` | — |
| `POST` | `/dashboards` | `create_dashboard` | — |
| `GET` | `/dashboards/{dashboard_id}` | `get_dashboard` | — |
| `PUT` | `/dashboards/{dashboard_id}` | `update_dashboard` | — |
| `DELETE` | `/dashboards/{dashboard_id}` | `delete_dashboard` | — |
| `GET` | `/dashboards/{dashboard_id}/widgets` | `list_widgets` | — |
| `POST` | `/dashboards/{dashboard_id}/widgets` | `create_widget` | — |
| `PUT` | `/widgets/{widget_id}` | `update_widget` | — |
| `DELETE` | `/widgets/{widget_id}` | `delete_widget` | — |
| `POST` | `/query` | `execute_query` | Execute a SELECT-only SQL query and return results. |
| `GET` | `/saved-queries` | `list_saved_queries` | — |
| `POST` | `/saved-queries` | `create_saved_query` | — |
| `GET` | `/saved-queries/{query_id}` | `get_saved_query` | — |
| `PUT` | `/saved-queries/{query_id}` | `update_saved_query` | — |
| `DELETE` | `/saved-queries/{query_id}` | `delete_saved_query` | — |
| `GET` | `/reports` | `list_reports` | — |
| `POST` | `/reports` | `create_report` | — |
| `POST` | `/reports/{report_id}/run` | `run_report` | — |
| `GET` | `/reports/{report_id}/download` | `download_report` | — |
| `GET` | `/alerts` | `list_alerts` | — |
| `POST` | `/alerts` | `create_alert` | — |
| `PUT` | `/alerts/{alert_id}` | `update_alert` | — |
| `DELETE` | `/alerts/{alert_id}` | `delete_alert` | — |
| `GET` | `/modules/{module}/kpis` | `module_kpis` | — |
| `GET` | `/modules/{module}/trends` | `module_trends` | — |
| `GET` | `/cross-module/summary` | `cross_module_summary` | — |
| `POST` | `/usage/track` | `track_usage` | — |
| `GET` | `/dashboards/{dashboard_id}/rls` | `list_rls_rules` | — |
| `POST` | `/dashboards/{dashboard_id}/rls` | `create_rls_rule` | — |
| `DELETE` | `/dashboards/{dashboard_id}/rls/{rule_id}` | `delete_rls_rule` | — |
| `GET` | `/meta/usage` | `get_usage_stats` | — |
| `POST` | `/export/pptx` | `export_dashboard_pptx` | — |
| `POST` | `/lineage` | `create_lineage_entry` | — |
| `GET` | `/lineage/widget/{widget_id}` | `get_widget_lineage` | — |
| `GET` | `/lineage/dashboard/{dashboard_id}` | `get_dashboard_lineage` | — |

### `GET /dashboards`

**Function:** `list_dashboards` (line 223)

**Parameters:** `skip`, `limit`

**Auth:** `current_user`


### `POST /dashboards`

**Function:** `create_dashboard` (line 242)

**Parameters:** `body`

**Auth:** `current_user`


### `GET /dashboards/{dashboard_id}`

**Function:** `get_dashboard` (line 261)

**Parameters:** `dashboard_id`

**Auth:** `current_user`


### `PUT /dashboards/{dashboard_id}`

**Function:** `update_dashboard` (line 276)

**Parameters:** `dashboard_id`, `body`

**Auth:** `current_user`


### `DELETE /dashboards/{dashboard_id}`

**Function:** `delete_dashboard` (line 296)

**Parameters:** `dashboard_id`

**Auth:** `current_user`


### `GET /dashboards/{dashboard_id}/widgets`

**Function:** `list_widgets` (line 317)

**Parameters:** `dashboard_id`

**Auth:** `current_user`


### `POST /dashboards/{dashboard_id}/widgets`

**Function:** `create_widget` (line 341)

**Parameters:** `dashboard_id`, `body`

**Auth:** `current_user`


### `PUT /widgets/{widget_id}`

**Function:** `update_widget` (line 370)

**Parameters:** `widget_id`, `body`

**Auth:** `current_user`


### `DELETE /widgets/{widget_id}`

**Function:** `delete_widget` (line 399)

**Parameters:** `widget_id`

**Auth:** `current_user`


### `POST /query`

**Function:** `execute_query` (line 424)

Execute a SELECT-only SQL query and return results.

IMPORTANT: Only SELECT statements are allowed. All DDL/DML is rejected.
A LIMIT clause is enforced if not already present.

**Parameters:** `body`

**Auth:** `current_user`


### `GET /saved-queries`

**Function:** `list_saved_queries` (line 465)

**Parameters:** `module`, `skip`, `limit`

**Auth:** `current_user`


### `POST /saved-queries`

**Function:** `create_saved_query` (line 483)

**Parameters:** `body`

**Auth:** `current_user`


### `GET /saved-queries/{query_id}`

**Function:** `get_saved_query` (line 504)

**Parameters:** `query_id`

**Auth:** `current_user`


### `PUT /saved-queries/{query_id}`

**Function:** `update_saved_query` (line 519)

**Parameters:** `query_id`, `body`

**Auth:** `current_user`


### `DELETE /saved-queries/{query_id}`

**Function:** `delete_saved_query` (line 543)

**Parameters:** `query_id`

**Auth:** `current_user`


### `GET /reports`

**Function:** `list_reports` (line 564)

**Parameters:** `skip`, `limit`

**Auth:** `current_user`


### `POST /reports`

**Function:** `create_report` (line 581)

**Parameters:** `body`

**Auth:** `current_user`


### `POST /reports/{report_id}/run`

**Function:** `run_report` (line 602)

**Parameters:** `report_id`

**Auth:** `current_user`


### `GET /reports/{report_id}/download`

**Function:** `download_report` (line 650)

**Parameters:** `report_id`

**Auth:** `current_user`


### `GET /alerts`

**Function:** `list_alerts` (line 704)

**Parameters:** `skip`, `limit`

**Auth:** `current_user`


### `POST /alerts`

**Function:** `create_alert` (line 722)

**Parameters:** `body`

**Auth:** `current_user`


### `PUT /alerts/{alert_id}`

**Function:** `update_alert` (line 750)

**Parameters:** `alert_id`, `body`

**Auth:** `current_user`


### `DELETE /alerts/{alert_id}`

**Function:** `delete_alert` (line 772)

**Parameters:** `alert_id`

**Auth:** `current_user`


### `GET /modules/{module}/kpis`

**Function:** `module_kpis` (line 837)

**Parameters:** `module`

**Auth:** `current_user`


### `GET /modules/{module}/trends`

**Function:** `module_trends` (line 920)

**Parameters:** `module`, `months`

**Auth:** `current_user`


### `GET /cross-module/summary`

**Function:** `cross_module_summary` (line 964)

**Auth:** `current_user`


### `POST /usage/track`

**Function:** `track_usage` (line 1036)

**Parameters:** `payload`

**Auth:** `user`


### `GET /dashboards/{dashboard_id}/rls`

**Function:** `list_rls_rules` (line 1076)

**Parameters:** `dashboard_id`

**Auth:** `user`


### `POST /dashboards/{dashboard_id}/rls`

**Function:** `create_rls_rule` (line 1084)

**Parameters:** `dashboard_id`, `payload`

**Auth:** `user`


### `DELETE /dashboards/{dashboard_id}/rls/{rule_id}`

**Function:** `delete_rls_rule` (line 1101)

**Parameters:** `dashboard_id`, `rule_id`

**Auth:** `user`


### `GET /meta/usage`

**Function:** `get_usage_stats` (line 1124)

**Parameters:** `days`

**Auth:** `user`


### `POST /export/pptx`

**Function:** `export_dashboard_pptx` (line 1190)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /lineage`

**Function:** `create_lineage_entry` (line 1245)

**Parameters:** `body`

**Response model:** `LineageNodeOut`

**Auth:** `current_user`


### `GET /lineage/widget/{widget_id}`

**Function:** `get_widget_lineage` (line 1275)

**Parameters:** `widget_id`

**Response model:** `LineageGraphOut`

**Auth:** `current_user`


### `GET /lineage/dashboard/{dashboard_id}`

**Function:** `get_dashboard_lineage` (line 1332)

**Parameters:** `dashboard_id`

**Response model:** `LineageGraphOut`

**Auth:** `current_user`


---

## analytics_schema.py

Analytics Schema Introspection API — zero-config data connectivity.

Exposes the full ERP database schema (tables, columns, types, foreign keys)
grouped by module, enabling the dashboard builder and copilot to auto-discover
all available data sources without manual configuration.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/schema` | `get_schema` | Return full database schema grouped by module. |
| `GET` | `/schema/tables` | `list_tables` | Return a flat list of table names, optionally filtered by module. |
| `GET` | `/schema/tables/{table_name}/columns` | `get_table_columns` | Return columns for a specific table with sample values. |
| `GET` | `/schema/relationships` | `get_relationships` | Return all foreign key relationships, optionally filtered by module. |
| `GET` | `/schema/modules` | `list_modules` | Return all ERP modules with their table counts. |
| `GET` | `/schema/search` | `search_schema` | Search tables and columns by name. Powers the schema browser autocomplete. |
| `POST` | `/copilot/query` | `copilot_ask` | Natural language query — ask anything about your ERP data. |
| `GET` | `/semantic-models` | `list_semantic_models` | List all semantic models, optionally filtered by module. |
| `POST` | `/semantic-models/generate` | `generate_models` | Auto-generate semantic models for all ERP modules. |
| `POST` | `/semantic-models/{module}/refresh` | `refresh_model` | Re-generate the semantic model for a specific module. |
| `GET` | `/semantic-models/{model_id}` | `get_semantic_model` | Get full details of a semantic model. |
| `GET` | `/dashboards/{dashboard_id}/bookmarks` | `list_bookmarks` | List all bookmarks for a dashboard. |
| `POST` | `/dashboards/{dashboard_id}/bookmarks` | `create_bookmark` | Save current filter/visual state as a named bookmark. |
| `DELETE` | `/dashboards/{dashboard_id}/bookmarks/{bookmark_id}` | `delete_bookmark` | Delete a bookmark. |
| `POST` | `/dashboards/{dashboard_id}/shares` | `create_share` | — |
| `GET` | `/dashboards/{dashboard_id}/shares` | `list_shares` | — |
| `DELETE` | `/dashboards/{dashboard_id}/shares/{share_id}` | `delete_share` | — |
| `POST` | `/embed/tokens` | `create_embed_token` | — |
| `GET` | `/embed/tokens` | `list_embed_tokens` | — |
| `GET` | `/embed/{token}` | `get_embed_dashboard` | — |
| `DELETE` | `/embed/tokens/{token_id}` | `delete_embed_token` | — |
| `GET` | `/compliance/kra-itax` | `kra_itax_report` | — |
| `GET` | `/compliance/nhif-nssf` | `nhif_nssf_report` | — |
| `GET` | `/compliance/vat-return` | `vat_return_report` | — |
| `POST` | `/whatif/simulate` | `whatif_simulate` | — |

### `GET /schema`

**Function:** `get_schema` (line 104)

Return full database schema grouped by module.

Introspects information_schema to return all tables, columns, types,
and foreign key relationships. This powers the dashboard builder's
data source picker and the Copilot's schema context.

**Parameters:** `module`

**Response model:** `SchemaResponse`

**Auth:** `user`


### `GET /schema/tables`

**Function:** `list_tables` (line 258)

Return a flat list of table names, optionally filtered by module.

**Parameters:** `module`

**Auth:** `user`


### `GET /schema/tables/{table_name}/columns`

**Function:** `get_table_columns` (line 282)

Return columns for a specific table with sample values.

**Parameters:** `table_name`

**Auth:** `user`


### `GET /schema/relationships`

**Function:** `get_relationships` (line 343)

Return all foreign key relationships, optionally filtered by module.

**Parameters:** `module`

**Response model:** `RelationshipsResponse`

**Auth:** `user`


### `GET /schema/modules`

**Function:** `list_modules` (line 395)

Return all ERP modules with their table counts.

**Auth:** `user`


### `GET /schema/search`

**Function:** `search_schema` (line 422)

Search tables and columns by name. Powers the schema browser autocomplete.

**Parameters:** `q`

**Auth:** `user`


### `POST /copilot/query`

**Function:** `copilot_ask` (line 475)

Natural language query — ask anything about your ERP data.

Converts the question to SQL via LLM, executes it read-only,
and returns data + AI-generated narrative + chart suggestions.

**Parameters:** `body`

**Auth:** `user`


### `GET /semantic-models`

**Function:** `list_semantic_models` (line 496)

List all semantic models, optionally filtered by module.

**Parameters:** `module`

**Auth:** `user`


### `POST /semantic-models/generate`

**Function:** `generate_models` (line 529)

Auto-generate semantic models for all ERP modules.

**Auth:** `user`


### `POST /semantic-models/{module}/refresh`

**Function:** `refresh_model` (line 544)

Re-generate the semantic model for a specific module.

**Parameters:** `module`

**Auth:** `user`


### `GET /semantic-models/{model_id}`

**Function:** `get_semantic_model` (line 563)

Get full details of a semantic model.

**Parameters:** `model_id`

**Auth:** `user`


### `GET /dashboards/{dashboard_id}/bookmarks`

**Function:** `list_bookmarks` (line 612)

List all bookmarks for a dashboard.

**Parameters:** `dashboard_id`

**Auth:** `user`


### `POST /dashboards/{dashboard_id}/bookmarks`

**Function:** `create_bookmark` (line 640)

Save current filter/visual state as a named bookmark.

**Parameters:** `dashboard_id`, `body`

**Auth:** `user`


### `DELETE /dashboards/{dashboard_id}/bookmarks/{bookmark_id}`

**Function:** `delete_bookmark` (line 681)

Delete a bookmark.

**Parameters:** `dashboard_id`, `bookmark_id`

**Auth:** `user`


### `POST /dashboards/{dashboard_id}/shares`

**Function:** `create_share` (line 710)

**Parameters:** `dashboard_id`, `payload`

**Auth:** `user`


### `GET /dashboards/{dashboard_id}/shares`

**Function:** `list_shares` (line 727)

**Parameters:** `dashboard_id`

**Auth:** `user`


### `DELETE /dashboards/{dashboard_id}/shares/{share_id}`

**Function:** `delete_share` (line 735)

**Parameters:** `dashboard_id`, `share_id`

**Auth:** `user`


### `POST /embed/tokens`

**Function:** `create_embed_token` (line 753)

**Parameters:** `payload`

**Auth:** `user`


### `GET /embed/tokens`

**Function:** `list_embed_tokens` (line 768)

**Auth:** `user`


### `GET /embed/{token}`

**Function:** `get_embed_dashboard` (line 776)

**Parameters:** `token`


### `DELETE /embed/tokens/{token_id}`

**Function:** `delete_embed_token` (line 799)

**Parameters:** `token_id`

**Auth:** `user`


### `GET /compliance/kra-itax`

**Function:** `kra_itax_report` (line 817)

**Parameters:** `year`

**Auth:** `user`


### `GET /compliance/nhif-nssf`

**Function:** `nhif_nssf_report` (line 856)

**Parameters:** `year`, `month`

**Auth:** `user`


### `GET /compliance/vat-return`

**Function:** `vat_return_report` (line 898)

**Parameters:** `year`, `quarter`

**Auth:** `user`


### `POST /whatif/simulate`

**Function:** `whatif_simulate` (line 947)

**Parameters:** `payload`

**Auth:** `user`

