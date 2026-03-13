# Manufacturing — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 145


## Contents

- [manufacturing.py](#manufacturing) (29 endpoints)
- [manufacturing_ai.py](#manufacturing-ai) (5 endpoints)
- [manufacturing_eco.py](#manufacturing-eco) (12 endpoints)
- [manufacturing_equipment.py](#manufacturing-equipment) (15 endpoints)
- [manufacturing_ext.py](#manufacturing-ext) (29 endpoints)
- [manufacturing_labor.py](#manufacturing-labor) (11 endpoints)
- [manufacturing_planning.py](#manufacturing-planning) (13 endpoints)
- [manufacturing_quality.py](#manufacturing-quality) (18 endpoints)
- [manufacturing_trace.py](#manufacturing-trace) (13 endpoints)

---

## manufacturing.py

Manufacturing API — BOM, Work Orders, Workstations, Quality Checks.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/bom` | `list_boms` | — |
| `POST` | `/bom` | `create_bom` | — |
| `GET` | `/bom/{bom_id}` | `get_bom` | — |
| `PUT` | `/bom/{bom_id}` | `update_bom` | — |
| `DELETE` | `/bom/{bom_id}` | `delete_bom` | — |
| `GET` | `/bom/{bom_id}/cost` | `bom_cost` | Recursively calculate the total material cost for one unit produced by this BOM. |
| `GET` | `/workstations` | `list_workstations` | — |
| `POST` | `/workstations` | `create_workstation` | — |
| `GET` | `/workstations/{ws_id}` | `get_workstation` | — |
| `PUT` | `/workstations/{ws_id}` | `update_workstation` | — |
| `GET` | `/work-orders` | `list_work_orders` | — |
| `POST` | `/work-orders` | `create_work_order` | — |
| `GET` | `/work-orders/{wo_id}` | `get_work_order` | — |
| `PUT` | `/work-orders/{wo_id}` | `update_work_order` | — |
| `POST` | `/work-orders/{wo_id}/start` | `start_work_order` | — |
| `POST` | `/work-orders/{wo_id}/complete` | `complete_work_order` | — |
| `POST` | `/work-orders/{wo_id}/cancel` | `cancel_work_order` | — |
| `GET` | `/work-orders/{wo_id}/material-availability` | `check_material_availability` | — |
| `POST` | `/work-orders/{wo_id}/consume` | `consume_material` | — |
| `GET` | `/work-orders/{wo_id}/consumption` | `list_consumption` | — |
| `POST` | `/quality-checks` | `create_quality_check` | — |
| `GET` | `/quality-checks` | `list_quality_checks` | — |
| `GET` | `/quality-checks/{qc_id}` | `get_quality_check` | — |
| `GET` | `/dashboard/stats` | `manufacturing_dashboard` | — |
| `GET` | `/work-orders/{wo_id}/variance` | `get_work_order_variance` | — |
| `POST` | `/work-orders/{wo_id}/backflush` | `backflush_consumption` | — |
| `POST` | `/work-orders/{wo_id}/rework` | `create_rework_order` | — |
| `GET` | `/rework-orders` | `list_rework_orders` | — |
| `GET` | `/rework-orders/{rework_id}` | `get_rework_order` | — |

### `GET /bom`

**Function:** `list_boms` (line 270)

**Parameters:** `search`, `is_active`, `skip`, `limit`

**Auth:** `current_user`


### `POST /bom`

**Function:** `create_bom` (line 313)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /bom/{bom_id}`

**Function:** `get_bom` (line 382)

**Parameters:** `bom_id`

**Auth:** `current_user`


### `PUT /bom/{bom_id}`

**Function:** `update_bom` (line 416)

**Parameters:** `bom_id`, `payload`

**Auth:** `current_user`


### `DELETE /bom/{bom_id}`

**Function:** `delete_bom` (line 478)

**Parameters:** `bom_id`

**Auth:** `current_user`


### `GET /bom/{bom_id}/cost`

**Function:** `bom_cost` (line 493)

Recursively calculate the total material cost for one unit produced by this BOM.

**Parameters:** `bom_id`

**Auth:** `current_user`


### `GET /workstations`

**Function:** `list_workstations` (line 546)

**Auth:** `current_user`


### `POST /workstations`

**Function:** `create_workstation` (line 565)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /workstations/{ws_id}`

**Function:** `get_workstation` (line 585)

**Parameters:** `ws_id`

**Auth:** `current_user`


### `PUT /workstations/{ws_id}`

**Function:** `update_workstation` (line 601)

**Parameters:** `ws_id`, `payload`

**Auth:** `current_user`


### `GET /work-orders`

**Function:** `list_work_orders` (line 622)

**Parameters:** `status_filter`, `priority`, `search`, `skip`, `limit`

**Auth:** `current_user`


### `POST /work-orders`

**Function:** `create_work_order` (line 667)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /work-orders/{wo_id}`

**Function:** `get_work_order` (line 742)

**Parameters:** `wo_id`

**Auth:** `current_user`


### `PUT /work-orders/{wo_id}`

**Function:** `update_work_order` (line 764)

**Parameters:** `wo_id`, `payload`

**Auth:** `current_user`


### `POST /work-orders/{wo_id}/start`

**Function:** `start_work_order` (line 797)

**Parameters:** `wo_id`

**Auth:** `current_user`


### `POST /work-orders/{wo_id}/complete`

**Function:** `complete_work_order` (line 897)

**Parameters:** `wo_id`, `completed_quantity`, `rejected_quantity`

**Auth:** `current_user`


### `POST /work-orders/{wo_id}/cancel`

**Function:** `cancel_work_order` (line 975)

**Parameters:** `wo_id`

**Auth:** `current_user`


### `GET /work-orders/{wo_id}/material-availability`

**Function:** `check_material_availability` (line 999)

**Parameters:** `wo_id`

**Auth:** `current_user`


### `POST /work-orders/{wo_id}/consume`

**Function:** `consume_material` (line 1049)

**Parameters:** `wo_id`, `payload`

**Auth:** `current_user`


### `GET /work-orders/{wo_id}/consumption`

**Function:** `list_consumption` (line 1127)

**Parameters:** `wo_id`

**Auth:** `current_user`


### `POST /quality-checks`

**Function:** `create_quality_check` (line 1161)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /quality-checks`

**Function:** `list_quality_checks` (line 1190)

**Parameters:** `work_order_id`, `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `GET /quality-checks/{qc_id}`

**Function:** `get_quality_check` (line 1219)

**Parameters:** `qc_id`

**Auth:** `current_user`


### `GET /dashboard/stats`

**Function:** `manufacturing_dashboard` (line 1233)

**Auth:** `current_user`


### `GET /work-orders/{wo_id}/variance`

**Function:** `get_work_order_variance` (line 1311)

**Parameters:** `wo_id`

**Auth:** `user`


### `POST /work-orders/{wo_id}/backflush`

**Function:** `backflush_consumption` (line 1402)

**Parameters:** `wo_id`, `completed_quantity`

**Auth:** `user`


### `POST /work-orders/{wo_id}/rework`

**Function:** `create_rework_order` (line 1510)

**Parameters:** `wo_id`, `body`

**Response model:** `ReworkOrderOut`

**Auth:** `user`


### `GET /rework-orders`

**Function:** `list_rework_orders` (line 1539)

**Parameters:** `parent_wo_id`, `rework_status`, `skip`, `limit`

**Auth:** `user`


### `GET /rework-orders/{rework_id}`

**Function:** `get_rework_order` (line 1558)

**Parameters:** `rework_id`

**Response model:** `ReworkOrderOut`

**Auth:** `user`


---

## manufacturing_ai.py

Manufacturing Intelligence & AI — bottlenecks, quality risk, scheduling suggestions, executive summary.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/ai/bottlenecks` | `bottleneck_analysis` | Identify production bottlenecks by analyzing: |
| `GET` | `/ai/quality-risk` | `quality_risk_analysis` | Predict quality risk by analyzing: |
| `GET` | `/ai/schedule-suggestions` | `schedule_suggestions` | Rule-based scheduling recommendations. |
| `GET` | `/ai/executive-dashboard` | `executive_dashboard` | Executive manufacturing KPI dashboard linking to CRM deals and Projects. |
| `GET` | `/ai/executive-summary` | `executive_summary` | Generate NL executive summary of manufacturing KPIs using AI. |

### `GET /ai/bottlenecks`

**Function:** `bottleneck_analysis` (line 31)

Identify production bottlenecks by analyzing:
- WO queue time per workstation (planned_start → actual_start lag)
- Workstation utilization from capacity slots
- Downtime frequency per workstation

**Parameters:** `days`

**Auth:** `user`


### `GET /ai/quality-risk`

**Function:** `quality_risk_analysis` (line 115)

Predict quality risk by analyzing:
- Recent NCR severity trends
- SPC out-of-control rate per inspection plan item
- QC pass rate trends per workstation

**Parameters:** `days`

**Auth:** `user`


### `GET /ai/schedule-suggestions`

**Function:** `schedule_suggestions` (line 223)

Rule-based scheduling recommendations.

**Auth:** `user`


### `GET /ai/executive-dashboard`

**Function:** `executive_dashboard` (line 313)

Executive manufacturing KPI dashboard linking to CRM deals and Projects.

**Auth:** `user`


### `GET /ai/executive-summary`

**Function:** `executive_summary` (line 392)

Generate NL executive summary of manufacturing KPIs using AI.

**Auth:** `user`


---

## manufacturing_eco.py

Manufacturing ECO API — Engineering Change Orders & Material Substitutions.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/eco` | `create_eco` | — |
| `GET` | `/eco` | `list_ecos` | — |
| `GET` | `/eco/{eco_id}` | `get_eco` | — |
| `PUT` | `/eco/{eco_id}` | `update_eco` | — |
| `POST` | `/eco/{eco_id}/submit` | `submit_eco` | — |
| `POST` | `/eco/{eco_id}/add-approvers` | `add_eco_approvers` | — |
| `POST` | `/eco/{eco_id}/approve` | `approve_eco` | — |
| `POST` | `/eco/{eco_id}/implement` | `implement_eco` | — |
| `GET` | `/bom/{bom_id}/versions` | `list_bom_versions` | — |
| `GET` | `/bom/{bom_id}/substitutions` | `list_bom_substitutions` | — |
| `POST` | `/bom-items/{item_id}/substitutions` | `add_substitution` | — |
| `DELETE` | `/substitutions/{sub_id}` | `delete_substitution` | — |

### `POST /eco`

**Function:** `create_eco` (line 134)

**Parameters:** `body`

**Response model:** `ECOOut`

**Auth:** `user`


### `GET /eco`

**Function:** `list_ecos` (line 158)

**Parameters:** `bom_id`, `eco_status`, `skip`, `limit`

**Auth:** `user`


### `GET /eco/{eco_id}`

**Function:** `get_eco` (line 177)

**Parameters:** `eco_id`

**Response model:** `ECODetailOut`

**Auth:** `user`


### `PUT /eco/{eco_id}`

**Function:** `update_eco` (line 190)

**Parameters:** `eco_id`, `body`

**Response model:** `ECOOut`

**Auth:** `user`


### `POST /eco/{eco_id}/submit`

**Function:** `submit_eco` (line 208)

**Parameters:** `eco_id`

**Response model:** `ECOOut`

**Auth:** `user`


### `POST /eco/{eco_id}/add-approvers`

**Function:** `add_eco_approvers` (line 231)

**Parameters:** `eco_id`, `body`

**Response model:** `ECODetailOut`

**Auth:** `user`


### `POST /eco/{eco_id}/approve`

**Function:** `approve_eco` (line 257)

**Parameters:** `eco_id`, `body`

**Response model:** `ECOOut`

**Auth:** `user`


### `POST /eco/{eco_id}/implement`

**Function:** `implement_eco` (line 306)

**Parameters:** `eco_id`

**Response model:** `ECOOut`

**Auth:** `user`


### `GET /bom/{bom_id}/versions`

**Function:** `list_bom_versions` (line 386)

**Parameters:** `bom_id`

**Auth:** `user`


### `GET /bom/{bom_id}/substitutions`

**Function:** `list_bom_substitutions` (line 414)

**Parameters:** `bom_id`

**Auth:** `user`


### `POST /bom-items/{item_id}/substitutions`

**Function:** `add_substitution` (line 425)

**Parameters:** `item_id`, `body`

**Response model:** `SubstitutionOut`

**Auth:** `user`


### `DELETE /substitutions/{sub_id}`

**Function:** `delete_substitution` (line 446)

**Parameters:** `sub_id`

**Auth:** `user`


---

## manufacturing_equipment.py

Manufacturing Equipment & Maintenance — assets, downtime, MWOs, OEE.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/assets` | `create_asset` | — |
| `GET` | `/assets` | `list_assets` | — |
| `GET` | `/assets/{asset_id}` | `get_asset` | — |
| `PUT` | `/assets/{asset_id}` | `update_asset` | — |
| `GET` | `/assets/{asset_id}/history` | `asset_maintenance_history` | Return maintenance work orders and downtime records for an asset. |
| `POST` | `/downtime` | `log_downtime` | — |
| `GET` | `/downtime` | `list_downtime` | — |
| `PUT` | `/downtime/{record_id}/close` | `close_downtime` | — |
| `GET` | `/downtime/analysis/pareto` | `downtime_pareto` | Pareto analysis of downtime by category. |
| `GET` | `/oee/{workstation_id}` | `get_oee_detailed` | OEE = Availability × Performance × Quality |
| `POST` | `/maintenance-work-orders` | `create_mwo` | — |
| `GET` | `/maintenance-work-orders` | `list_mwos` | — |
| `GET` | `/maintenance-work-orders/{mwo_id}` | `get_mwo` | — |
| `PUT` | `/maintenance-work-orders/{mwo_id}` | `update_mwo` | — |
| `POST` | `/maintenance-work-orders/{mwo_id}/complete` | `complete_mwo` | — |

### `POST /assets`

**Function:** `create_asset` (line 100)

**Parameters:** `body`

**Auth:** `user`


### `GET /assets`

**Function:** `list_assets` (line 126)

**Parameters:** `workstation_id`, `status`

**Auth:** `user`


### `GET /assets/{asset_id}`

**Function:** `get_asset` (line 142)

**Parameters:** `asset_id`

**Auth:** `user`


### `PUT /assets/{asset_id}`

**Function:** `update_asset` (line 151)

**Parameters:** `asset_id`, `body`

**Auth:** `user`


### `GET /assets/{asset_id}/history`

**Function:** `asset_maintenance_history` (line 172)

Return maintenance work orders and downtime records for an asset.

**Parameters:** `asset_id`

**Auth:** `user`


### `POST /downtime`

**Function:** `log_downtime` (line 197)

**Parameters:** `body`

**Auth:** `user`


### `GET /downtime`

**Function:** `list_downtime` (line 230)

**Parameters:** `workstation_id`, `asset_id`, `downtime_type`

**Auth:** `user`


### `PUT /downtime/{record_id}/close`

**Function:** `close_downtime` (line 249)

**Parameters:** `record_id`, `body`

**Auth:** `user`


### `GET /downtime/analysis/pareto`

**Function:** `downtime_pareto` (line 279)

Pareto analysis of downtime by category.

**Parameters:** `workstation_id`, `days`

**Auth:** `user`


### `GET /oee/{workstation_id}`

**Function:** `get_oee_detailed` (line 326)

OEE = Availability × Performance × Quality
Availability = (Planned - Downtime) / Planned
Performance  = Actual output / Theoretical max output
Quality      = Good units / Total units

**Parameters:** `workstation_id`, `date_from`, `date_to`

**Auth:** `user`


### `POST /maintenance-work-orders`

**Function:** `create_mwo` (line 422)

**Parameters:** `body`

**Auth:** `user`


### `GET /maintenance-work-orders`

**Function:** `list_mwos` (line 449)

**Parameters:** `status`, `asset_id`

**Auth:** `user`


### `GET /maintenance-work-orders/{mwo_id}`

**Function:** `get_mwo` (line 465)

**Parameters:** `mwo_id`

**Auth:** `user`


### `PUT /maintenance-work-orders/{mwo_id}`

**Function:** `update_mwo` (line 474)

**Parameters:** `mwo_id`, `body`

**Auth:** `user`


### `POST /maintenance-work-orders/{mwo_id}/complete`

**Function:** `complete_mwo` (line 495)

**Parameters:** `mwo_id`, `body`

**Auth:** `user`


---

## manufacturing_ext.py

Manufacturing Extensions — Routing, Scrap, Maintenance, QC, Reports, Dashboard KPIs.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/routing` | `list_routing_steps` | — |
| `POST` | `/routing` | `create_routing_step` | — |
| `GET` | `/routing/{step_id}` | `get_routing_step` | — |
| `PUT` | `/routing/{step_id}` | `update_routing_step` | — |
| `POST` | `/scrap-entries` | `create_scrap_entry` | — |
| `GET` | `/scrap-entries` | `list_scrap_entries` | — |
| `GET` | `/maintenance-schedules` | `list_maintenance_schedules` | — |
| `POST` | `/maintenance-schedules` | `create_maintenance_schedule` | — |
| `PUT` | `/maintenance-schedules/{schedule_id}` | `update_maintenance_schedule` | — |
| `GET` | `/quality-control` | `list_quality_control` | — |
| `POST` | `/quality-control` | `create_quality_control` | — |
| `GET` | `/quality-control/{qc_id}` | `get_quality_control` | — |
| `GET` | `/reports/oee` | `report_oee` | Simplified OEE calculation per workstation based on completed work orders. |
| `GET` | `/reports/production-plan` | `report_production_plan` | List work orders planned or in-progress, grouped by status. |
| `GET` | `/dashboard/kpis` | `dashboard_kpis` | — |
| `GET` | `/routing-steps/{step_id}/instructions` | `get_work_instructions` | — |
| `PUT` | `/routing-steps/{step_id}/instructions` | `update_work_instructions` | — |
| `POST` | `/barcode-scan` | `barcode_scan` | Resolve a scanned barcode to the relevant entity. |
| `POST` | `/iot/ingest` | `ingest_iot_data` | Bulk-ingest IoT sensor data points. |
| `GET` | `/iot/data` | `get_iot_data` | Query recent IoT data points. |
| `GET` | `/production-board` | `production_board` | Live production board — all active work orders with workstation and schedule ... |
| `POST` | `/configurator/rules` | `create_configurator_rule` | — |
| `GET` | `/configurator/rules` | `list_configurator_rules` | — |
| `PUT` | `/configurator/rules/{rule_id}` | `update_configurator_rule` | — |
| `DELETE` | `/configurator/rules/{rule_id}` | `delete_configurator_rule` | — |
| `POST` | `/configurator/sessions` | `start_configurator_session` | Start a new CPQ configuration session for a BOM. |
| `GET` | `/configurator/sessions/{session_id}` | `get_configurator_session` | — |
| `POST` | `/configurator/sessions/{session_id}/select` | `apply_selection` | Apply a feature selection to a CPQ session and recompute the BOM. |
| `POST` | `/configurator/sessions/{session_id}/finalize` | `finalize_configurator_session` | Finalize CPQ session → create a new BOM from the configured items. |

### `GET /routing`

**Function:** `list_routing_steps` (line 138)

**Parameters:** `bom_id`, `skip`, `limit`

**Auth:** `current_user`


### `POST /routing`

**Function:** `create_routing_step` (line 168)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /routing/{step_id}`

**Function:** `get_routing_step` (line 195)

**Parameters:** `step_id`

**Auth:** `current_user`


### `PUT /routing/{step_id}`

**Function:** `update_routing_step` (line 211)

**Parameters:** `step_id`, `payload`

**Auth:** `current_user`


### `POST /scrap-entries`

**Function:** `create_scrap_entry` (line 239)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /scrap-entries`

**Function:** `list_scrap_entries` (line 262)

**Parameters:** `work_order_id`, `skip`, `limit`

**Auth:** `current_user`


### `GET /maintenance-schedules`

**Function:** `list_maintenance_schedules` (line 291)

**Parameters:** `workstation_id`, `is_active`, `skip`, `limit`

**Auth:** `current_user`


### `POST /maintenance-schedules`

**Function:** `create_maintenance_schedule` (line 324)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /maintenance-schedules/{schedule_id}`

**Function:** `update_maintenance_schedule` (line 356)

**Parameters:** `schedule_id`, `payload`

**Auth:** `current_user`


### `GET /quality-control`

**Function:** `list_quality_control` (line 379)

**Parameters:** `work_order_id`, `result_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /quality-control`

**Function:** `create_quality_control` (line 412)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /quality-control/{qc_id}`

**Function:** `get_quality_control` (line 441)

**Parameters:** `qc_id`

**Auth:** `current_user`


### `GET /reports/oee`

**Function:** `report_oee` (line 457)

Simplified OEE calculation per workstation based on completed work orders.
OEE = Availability x Performance x Quality (approximated from data).

**Auth:** `current_user`


### `GET /reports/production-plan`

**Function:** `report_production_plan` (line 542)

List work orders planned or in-progress, grouped by status.

**Parameters:** `days_ahead`

**Auth:** `current_user`


### `GET /dashboard/kpis`

**Function:** `dashboard_kpis` (line 587)

**Auth:** `current_user`


### `GET /routing-steps/{step_id}/instructions`

**Function:** `get_work_instructions` (line 689)

**Parameters:** `step_id`

**Auth:** `user`


### `PUT /routing-steps/{step_id}/instructions`

**Function:** `update_work_instructions` (line 709)

**Parameters:** `step_id`, `body`

**Auth:** `user`


### `POST /barcode-scan`

**Function:** `barcode_scan` (line 727)

Resolve a scanned barcode to the relevant entity.

**Parameters:** `body`

**Auth:** `user`


### `POST /iot/ingest`

**Function:** `ingest_iot_data` (line 782)

Bulk-ingest IoT sensor data points.

**Parameters:** `body`

**Auth:** `user`


### `GET /iot/data`

**Function:** `get_iot_data` (line 812)

Query recent IoT data points.

**Parameters:** `workstation_id`, `metric_name`, `hours`

**Auth:** `user`


### `GET /production-board`

**Function:** `production_board` (line 834)

Live production board — all active work orders with workstation and schedule status.

**Auth:** `user`


### `POST /configurator/rules`

**Function:** `create_configurator_rule` (line 898)

**Parameters:** `body`

**Auth:** `user`


### `GET /configurator/rules`

**Function:** `list_configurator_rules` (line 921)

**Parameters:** `bom_id`

**Auth:** `user`


### `PUT /configurator/rules/{rule_id}`

**Function:** `update_configurator_rule` (line 935)

**Parameters:** `rule_id`, `body`

**Auth:** `user`


### `DELETE /configurator/rules/{rule_id}`

**Function:** `delete_configurator_rule` (line 955)

**Parameters:** `rule_id`

**Auth:** `user`


### `POST /configurator/sessions`

**Function:** `start_configurator_session` (line 970)

Start a new CPQ configuration session for a BOM.

**Parameters:** `bom_id`

**Auth:** `user`


### `GET /configurator/sessions/{session_id}`

**Function:** `get_configurator_session` (line 1018)

**Parameters:** `session_id`

**Auth:** `user`


### `POST /configurator/sessions/{session_id}/select`

**Function:** `apply_selection` (line 1032)

Apply a feature selection to a CPQ session and recompute the BOM.

**Parameters:** `session_id`, `body`

**Auth:** `user`


### `POST /configurator/sessions/{session_id}/finalize`

**Function:** `finalize_configurator_session` (line 1113)

Finalize CPQ session → create a new BOM from the configured items.

**Parameters:** `session_id`

**Auth:** `user`


---

## manufacturing_labor.py

Manufacturing Labor & Workforce — operator skills, crew scheduling, timesheet push.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/skills` | `create_skill` | — |
| `GET` | `/skills` | `list_skills` | — |
| `PUT` | `/skills/{skill_id}` | `update_skill` | — |
| `DELETE` | `/skills/{skill_id}` | `delete_skill` | — |
| `GET` | `/skills/matrix` | `skills_matrix` | Return skills matrix: employee × skill → proficiency level. |
| `GET` | `/skills/expiring` | `expiring_certifications` | Return skills with certifications expiring within N days. |
| `POST` | `/crew` | `create_crew_assignment` | — |
| `GET` | `/crew` | `list_crew_assignments` | — |
| `POST` | `/crew/{assignment_id}/log-hours` | `log_hours` | — |
| `POST` | `/crew/push-timesheet` | `push_timesheet` | Push crew assignment hours to HR attendance records. |
| `GET` | `/crew/schedule` | `crew_schedule` | Return crew assignments grouped by date for schedule display. |

### `POST /skills`

**Function:** `create_skill` (line 63)

**Parameters:** `body`

**Auth:** `user`


### `GET /skills`

**Function:** `list_skills` (line 82)

**Parameters:** `employee_id`, `skill_name`

**Auth:** `user`


### `PUT /skills/{skill_id}`

**Function:** `update_skill` (line 98)

**Parameters:** `skill_id`, `body`

**Auth:** `user`


### `DELETE /skills/{skill_id}`

**Function:** `delete_skill` (line 119)

**Parameters:** `skill_id`

**Auth:** `user`


### `GET /skills/matrix`

**Function:** `skills_matrix` (line 129)

Return skills matrix: employee × skill → proficiency level.
Groups by (employee_id, skill_name) since one employee can have multiple skills.

**Auth:** `user`


### `GET /skills/expiring`

**Function:** `expiring_certifications` (line 160)

Return skills with certifications expiring within N days.

**Parameters:** `days`

**Auth:** `user`


### `POST /crew`

**Function:** `create_crew_assignment` (line 194)

**Parameters:** `body`

**Auth:** `user`


### `GET /crew`

**Function:** `list_crew_assignments` (line 215)

**Parameters:** `work_order_id`, `workstation_id`, `employee_id`, `assignment_date`

**Auth:** `user`


### `POST /crew/{assignment_id}/log-hours`

**Function:** `log_hours` (line 237)

**Parameters:** `assignment_id`, `body`

**Auth:** `user`


### `POST /crew/push-timesheet`

**Function:** `push_timesheet` (line 258)

Push crew assignment hours to HR attendance records.
Publishes mfg.timesheet.push event for each assignment.

**Parameters:** `body`

**Auth:** `user`


### `GET /crew/schedule`

**Function:** `crew_schedule` (line 296)

Return crew assignments grouped by date for schedule display.

**Parameters:** `date_from`, `date_to`, `workstation_id`

**Auth:** `user`


---

## manufacturing_planning.py

Manufacturing Planning & Scheduling — finite capacity, Gantt, scenarios.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/capacity-slots` | `create_capacity_slot` | — |
| `GET` | `/capacity-slots` | `list_capacity_slots` | — |
| `GET` | `/capacity/workstation/{workstation_id}` | `workstation_capacity` | Return utilization summary for a workstation over N weeks. |
| `GET` | `/capacity/rough-cut` | `rough_cut_capacity` | Compare aggregate demand (from planned WOs) vs aggregate capacity across all ... |
| `GET` | `/schedule` | `get_gantt_data` | Return Gantt-ready schedule entries. |
| `PUT` | `/schedule/{entry_id}` | `update_schedule_entry` | — |
| `POST` | `/schedule/run` | `run_scheduler` | Trigger finite capacity scheduling and return generated schedule entries. |
| `POST` | `/scenarios` | `create_scenario` | — |
| `GET` | `/scenarios` | `list_scenarios` | — |
| `GET` | `/scenarios/{scenario_id}` | `get_scenario` | — |
| `PUT` | `/scenarios/{scenario_id}` | `update_scenario` | — |
| `POST` | `/scenarios/{scenario_id}/run` | `run_scenario` | Run the scheduler for a specific scenario. |
| `DELETE` | `/scenarios/{scenario_id}` | `delete_scenario` | — |

### `POST /capacity-slots`

**Function:** `create_capacity_slot` (line 66)

**Parameters:** `body`

**Auth:** `user`


### `GET /capacity-slots`

**Function:** `list_capacity_slots` (line 83)

**Parameters:** `workstation_id`, `date_from`, `date_to`

**Auth:** `user`


### `GET /capacity/workstation/{workstation_id}`

**Function:** `workstation_capacity` (line 103)

Return utilization summary for a workstation over N weeks.

**Parameters:** `workstation_id`, `weeks`

**Auth:** `user`


### `GET /capacity/rough-cut`

**Function:** `rough_cut_capacity` (line 144)

Compare aggregate demand (from planned WOs) vs aggregate capacity across all workstations.

**Parameters:** `weeks`

**Auth:** `user`


### `GET /schedule`

**Function:** `get_gantt_data` (line 192)

Return Gantt-ready schedule entries.

**Parameters:** `scenario_id`, `date_from`, `date_to`

**Auth:** `user`


### `PUT /schedule/{entry_id}`

**Function:** `update_schedule_entry` (line 229)

**Parameters:** `entry_id`, `body`

**Auth:** `user`


### `POST /schedule/run`

**Function:** `run_scheduler` (line 253)

Trigger finite capacity scheduling and return generated schedule entries.

**Parameters:** `scenario_id`

**Auth:** `user`


### `POST /scenarios`

**Function:** `create_scenario` (line 266)

**Parameters:** `body`

**Auth:** `user`


### `GET /scenarios`

**Function:** `list_scenarios` (line 281)

**Auth:** `user`


### `GET /scenarios/{scenario_id}`

**Function:** `get_scenario` (line 287)

**Parameters:** `scenario_id`

**Auth:** `user`


### `PUT /scenarios/{scenario_id}`

**Function:** `update_scenario` (line 296)

**Parameters:** `scenario_id`, `body`

**Auth:** `user`


### `POST /scenarios/{scenario_id}/run`

**Function:** `run_scenario` (line 314)

Run the scheduler for a specific scenario.

**Parameters:** `scenario_id`

**Auth:** `user`


### `DELETE /scenarios/{scenario_id}`

**Function:** `delete_scenario` (line 334)

**Parameters:** `scenario_id`

**Auth:** `user`


---

## manufacturing_quality.py

Manufacturing Quality API — Inspection Plans, NCR, CAPA, SPC.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/inspection-plans` | `create_inspection_plan` | — |
| `GET` | `/inspection-plans` | `list_inspection_plans` | — |
| `GET` | `/inspection-plans/{plan_id}` | `get_inspection_plan` | — |
| `PUT` | `/inspection-plans/{plan_id}` | `update_inspection_plan` | — |
| `POST` | `/inspection-plans/{plan_id}/items` | `add_inspection_plan_item` | — |
| `DELETE` | `/inspection-plans/{plan_id}/items/{item_id}` | `delete_inspection_plan_item` | — |
| `POST` | `/ncr` | `create_ncr` | — |
| `GET` | `/ncr` | `list_ncrs` | — |
| `GET` | `/ncr/{ncr_id}` | `get_ncr` | — |
| `PUT` | `/ncr/{ncr_id}` | `update_ncr` | — |
| `GET` | `/quality/supplier-scorecard/{supplier_id}` | `supplier_quality_scorecard` | — |
| `POST` | `/capa` | `create_capa` | — |
| `GET` | `/capa` | `list_capas` | — |
| `GET` | `/capa/{capa_id}` | `get_capa` | — |
| `PUT` | `/capa/{capa_id}` | `update_capa` | — |
| `POST` | `/capa/{capa_id}/verify` | `verify_capa` | — |
| `POST` | `/spc/data-points` | `record_spc_data_point` | — |
| `GET` | `/spc/control-chart/{plan_item_id}` | `get_spc_control_chart` | — |

### `POST /inspection-plans`

**Function:** `create_inspection_plan` (line 240)

**Parameters:** `body`

**Response model:** `InspectionPlanDetailOut`

**Auth:** `user`


### `GET /inspection-plans`

**Function:** `list_inspection_plans` (line 270)

**Parameters:** `bom_id`, `is_active`, `skip`, `limit`

**Auth:** `user`


### `GET /inspection-plans/{plan_id}`

**Function:** `get_inspection_plan` (line 289)

**Parameters:** `plan_id`

**Response model:** `InspectionPlanDetailOut`

**Auth:** `user`


### `PUT /inspection-plans/{plan_id}`

**Function:** `update_inspection_plan` (line 302)

**Parameters:** `plan_id`, `body`

**Response model:** `InspectionPlanOut`

**Auth:** `user`


### `POST /inspection-plans/{plan_id}/items`

**Function:** `add_inspection_plan_item` (line 314)

**Parameters:** `plan_id`, `body`

**Response model:** `InspectionPlanItemOut`

**Auth:** `user`


### `DELETE /inspection-plans/{plan_id}/items/{item_id}`

**Function:** `delete_inspection_plan_item` (line 327)

**Parameters:** `plan_id`, `item_id`

**Auth:** `user`


### `POST /ncr`

**Function:** `create_ncr` (line 338)

**Parameters:** `body`

**Response model:** `NCROut`

**Auth:** `user`


### `GET /ncr`

**Function:** `list_ncrs` (line 366)

**Parameters:** `ncr_status`, `severity`, `work_order_id`, `supplier_id`, `skip`, `limit`

**Auth:** `user`


### `GET /ncr/{ncr_id}`

**Function:** `get_ncr` (line 391)

**Parameters:** `ncr_id`

**Response model:** `NCROut`

**Auth:** `user`


### `PUT /ncr/{ncr_id}`

**Function:** `update_ncr` (line 399)

**Parameters:** `ncr_id`, `body`

**Response model:** `NCROut`

**Auth:** `user`


### `GET /quality/supplier-scorecard/{supplier_id}`

**Function:** `supplier_quality_scorecard` (line 418)

**Parameters:** `supplier_id`

**Auth:** `user`


### `POST /capa`

**Function:** `create_capa` (line 461)

**Parameters:** `body`

**Response model:** `CAPAOut`

**Auth:** `user`


### `GET /capa`

**Function:** `list_capas` (line 482)

**Parameters:** `capa_status`, `capa_type`, `ncr_id`, `skip`, `limit`

**Auth:** `user`


### `GET /capa/{capa_id}`

**Function:** `get_capa` (line 504)

**Parameters:** `capa_id`

**Response model:** `CAPAOut`

**Auth:** `user`


### `PUT /capa/{capa_id}`

**Function:** `update_capa` (line 512)

**Parameters:** `capa_id`, `body`

**Response model:** `CAPAOut`

**Auth:** `user`


### `POST /capa/{capa_id}/verify`

**Function:** `verify_capa` (line 524)

**Parameters:** `capa_id`, `body`

**Response model:** `CAPAOut`

**Auth:** `user`


### `POST /spc/data-points`

**Function:** `record_spc_data_point` (line 547)

**Parameters:** `body`

**Response model:** `SPCDataPointOut`

**Auth:** `user`


### `GET /spc/control-chart/{plan_item_id}`

**Function:** `get_spc_control_chart` (line 575)

**Parameters:** `plan_item_id`, `work_order_id`, `limit`

**Auth:** `user`


---

## manufacturing_trace.py

Manufacturing Traceability API — Lot/Serial Tracking, Genealogy, Batch Records.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/lots` | `create_lot_serial` | — |
| `GET` | `/lots` | `list_lots` | — |
| `GET` | `/lots/{lot_id}` | `get_lot_serial` | — |
| `POST` | `/lots/{lot_id}/events` | `record_trace_event` | — |
| `GET` | `/lots/{lot_id}/events` | `get_lot_events` | — |
| `GET` | `/lots/{lot_id}/trace-forward` | `trace_forward` | Forward traceability: where did this lot/serial go? |
| `GET` | `/lots/{lot_id}/trace-backward` | `trace_backward` | Backward traceability: where did this lot/serial come from? |
| `GET` | `/lots/{lot_id}/genealogy` | `get_genealogy` | Product genealogy tree — parent and child relationships. |
| `POST` | `/batch-records` | `create_batch_record` | — |
| `GET` | `/batch-records` | `list_batch_records` | — |
| `GET` | `/batch-records/{record_id}` | `get_batch_record` | — |
| `PUT` | `/batch-records/{record_id}` | `update_batch_record` | — |
| `POST` | `/batch-records/{record_id}/approve` | `approve_batch_record` | — |

### `POST /lots`

**Function:** `create_lot_serial` (line 133)

**Parameters:** `body`

**Response model:** `LotSerialOut`

**Auth:** `user`


### `GET /lots`

**Function:** `list_lots` (line 165)

**Parameters:** `item_id`, `work_order_id`, `tracking_type`, `lot_status`, `skip`, `limit`

**Auth:** `user`


### `GET /lots/{lot_id}`

**Function:** `get_lot_serial` (line 190)

**Parameters:** `lot_id`

**Response model:** `LotSerialOut`

**Auth:** `user`


### `POST /lots/{lot_id}/events`

**Function:** `record_trace_event` (line 198)

**Parameters:** `lot_id`, `body`

**Response model:** `TraceEventOut`

**Auth:** `user`


### `GET /lots/{lot_id}/events`

**Function:** `get_lot_events` (line 230)

**Parameters:** `lot_id`

**Auth:** `user`


### `GET /lots/{lot_id}/trace-forward`

**Function:** `trace_forward` (line 240)

Forward traceability: where did this lot/serial go?

**Parameters:** `lot_id`

**Auth:** `user`


### `GET /lots/{lot_id}/trace-backward`

**Function:** `trace_backward` (line 307)

Backward traceability: where did this lot/serial come from?

**Parameters:** `lot_id`

**Auth:** `user`


### `GET /lots/{lot_id}/genealogy`

**Function:** `get_genealogy` (line 353)

Product genealogy tree — parent and child relationships.

**Parameters:** `lot_id`

**Auth:** `user`


### `POST /batch-records`

**Function:** `create_batch_record` (line 396)

**Parameters:** `body`

**Response model:** `BatchRecordOut`

**Auth:** `user`


### `GET /batch-records`

**Function:** `list_batch_records` (line 415)

**Parameters:** `work_order_id`, `record_status`, `skip`, `limit`

**Auth:** `user`


### `GET /batch-records/{record_id}`

**Function:** `get_batch_record` (line 434)

**Parameters:** `record_id`

**Response model:** `BatchRecordOut`

**Auth:** `user`


### `PUT /batch-records/{record_id}`

**Function:** `update_batch_record` (line 442)

**Parameters:** `record_id`, `body`

**Response model:** `BatchRecordOut`

**Auth:** `user`


### `POST /batch-records/{record_id}/approve`

**Function:** `approve_batch_record` (line 457)

**Parameters:** `record_id`, `body`

**Response model:** `BatchRecordOut`

**Auth:** `user`

